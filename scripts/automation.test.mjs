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

test('trusted vendors outrank newer unknown releases in policy order', () => {
  const model = (id, date) => ({ id, release_date: date, cost: { input: 0, output: 0 }, capabilities: { toolcall: true, reasoning: true } });
  const models = [
    model('flint-40b-free', '2026-10-21'),
    model('unknown-new', '2026-10-20'),
    model('muse-1-free', '2026-09-01'),
    model('step-3-free', '2026-09-01'),
    model('qwen3-coder-free', '2026-09-01'),
    model('kimi-k2-free', '2026-09-01'),
    model('minimax-m3.1-flash-free', '2026-09-01'),
    model('glm-5.3-flash-free', '2026-09-01'),
    model('deepseek-v4.1-flash-free', '2026-09-01'),
  ];
  assert.deepEqual(rankFreeModels(models).map(m => m.id), [
    'deepseek-v4.1-flash-free',
    'glm-5.3-flash-free',
    'minimax-m3.1-flash-free',
    'kimi-k2-free',
    'qwen3-coder-free',
    'step-3-free',
    'muse-1-free',
    'flint-40b-free',
    'unknown-new',
  ]);
});

test('newest release wins within a trusted vendor, but an older trusted model still beats untrusted releases', () => {
  const model = (id, date) => ({ id, release_date: date, cost: { input: 0, output: 0 }, capabilities: { toolcall: true, reasoning: true } });
  const models = [
    model('deepseek-old', '2025-01-01'),
    model('deepseek-new', '2026-09-10'),
    model('glm-5.3-flash-free', '2026-08-26'),
    model('flint-40b-free', '2026-10-21'),
  ];
  assert.deepEqual(rankFreeModels(models).map(m => m.id), [
    'deepseek-new',
    'deepseek-old',
    'glm-5.3-flash-free',
    'flint-40b-free',
  ]);
});
