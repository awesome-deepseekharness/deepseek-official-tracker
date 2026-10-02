import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectReviewEvidence } from './review-evidence.mjs';

test('live evidence preserves desktop links and dates despite an independent source outage', async () => {
  const results = await collectReviewEvidence(async url => {
    if (url.includes('api.github.com')) return new Response('rate limited', { status: 403 });
    if (url.endsWith('/dist-tags')) return new Response('{"latest":"0.2.0-rc.2"}');
    if (url.includes('/harness/')) return new Response('<title>DeepSeek Harness</title><h1>Preview</h1><a hidden href="https://download.deepseek.com/desktop/windows.exe">Windows</a><script>trackingNoise()</script>');
    return new Response('# Official README\n2026.09.30: Initial release.');
  });
  assert.equal(results.length, 5);
  const product = results[0];
  assert.equal(product.url, 'https://www.deepseek.com/harness/');
  assert.deepEqual(product.content.links, ['https://download.deepseek.com/desktop/windows.exe']);
  assert.equal(product.content.published, null);
  assert.ok(!product.content.text.includes('trackingNoise'));
  assert.ok(Number.isFinite(Date.parse(product.fetchedAt)));
  assert.equal(results[1].error, 'HTTP 403');
  assert.equal(results[2].content.latest, '0.2.0-rc.2');
  assert.match(results[3].content, /2026\.09\.30/);
});
