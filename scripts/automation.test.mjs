import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outputError, parseModelRegistry, rankFreeModels } from './opencode-runner.mjs';
import { decodeMcp } from './search-mcp.mjs';
import { renderTable } from './signals.mjs';
import { parseSignalTables } from '../site/src/lib/transit.mjs';

test('zero-exit OpenCode error events are failures, not successful reviews', () => {
  assert.ok(outputError('{"type":"error","error":{"name":"UnknownError"}}\n'));
  assert.ok(outputError('\x1b[91m\x1b[1mError: \x1b[0m{}'));
  assert.equal(outputError('{"type":"text","part":{"text":"done"}}\n'), null);
});
test('MCP supports JSON and SSE responses and rejects RPC errors', () => {
  assert.deepEqual(decodeMcp('{"result":{"tools":[]}}'), { tools: [] });
  assert.deepEqual(decodeMcp('event: message\r\ndata: {"result":{"content":[]}}\r\n\r\n'), { content: [] });
  assert.throws(() => decodeMcp('data: {"error":{"message":"rate limited"}}\n\n'), /rate limited/);
});
test('mixed new and existing signals have the same markdown table columns', () => {
  const text = renderTable([
    { isNew: true, date: '2026-10-01', source: 'HN', title: 'new', url: 'https://example.com/1' },
    { isNew: false, date: '2026-09-30', source: 'HN', title: 'old', url: 'https://example.com/2' },
  ], 'community');
  assert.equal(parseSignalTables(text).length, 2, 'Existing rows in a table with a New column must remain visible');
  assert.deepEqual(text.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').length), [6, 6, 6, 6]);
});

test('automatic model choice excludes paid/non-tool models and discovers new IDs', () => {
  const model = (id, date, extra = {}) => ({ id, release_date: date, cost: { input: 0, output: 0 }, capabilities: { toolcall: true, reasoning: true }, ...extra });
  const models = [model('old', '2026-01-01'), model('brand-new', '2026-10-02'),
    model('fake-free', '2026-10-03', { cost: { input: 1, output: 0 } }),
    model('cached-paid', '2026-10-03', { cost: { input: 0, output: 0, cache: { read: 1 } } }),
    model('no-tools', '2026-10-03', { capabilities: { toolcall: false } }),
    model('retired', '2026-10-03', { status: 'deprecated' })];
  assert.deepEqual(rankFreeModels(models).map(m => m.id), ['brand-new', 'old']);
  const output = models.map(m => `opencode/${m.id}\r\n${JSON.stringify(m, null, 2)}\r\n`).join('');
  assert.deepEqual(parseModelRegistry(output), models);
});
