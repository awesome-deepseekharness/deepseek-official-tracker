import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseProduct, trackProducts } from './products.mjs';

const html = '<title>DeepSeek Harness 开发者预览版</title><meta name="description" content="一切皆插件"><h1>Harness</h1><script src="/hash1.js"></script>';
test('bundle hashes do not count as product news and missing dates stay unknown', () => {
  assert.equal(parseProduct(html).published, null);
  assert.equal(parseProduct(html).fingerprint, parseProduct(html.replace('hash1', 'hash2')).fingerprint);
  assert.notEqual(parseProduct(html).fingerprint, parseProduct(html.replace('一切皆插件', 'New capability')).fingerprint);
  assert.throws(() => parseProduct('<title>Error</title>'), /expected title/);
});
test('product observation is idempotent and never invents a launch date', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-products-'));
  try {
    const fetchText = async () => html;
    assert.equal(await trackProducts({ root, fetchText, now: '2026-10-02T00:00:00Z' }), 1);
    const first = fs.readFileSync(path.join(root, 'product-news.md'), 'utf8');
    assert.match(first, /not a release date/);
    assert.equal(await trackProducts({ root, fetchText, now: '2026-10-03T00:00:00Z' }), 0);
    assert.equal(fs.readFileSync(path.join(root, 'product-news.md'), 'utf8'), first);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
