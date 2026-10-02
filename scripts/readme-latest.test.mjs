import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHighlights } from './readme-latest.mjs';

test('a newer Harness release replaces the older model headline in both languages', () => {
  const result = buildHighlights({
    changelog: [{ date: '2026-09-10', title: 'DeepSeek-V4.1-Flash Release', url: 'https://api-docs.deepseek.com/updates' }],
    releases: [{ date: '2026-09-29', title: 'deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2', url: 'https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2' }],
  });
  for (const lang of ['en', 'zh']) {
    assert.match(result[lang].latest.split('\n')[0], /dsh-v0\.2\.0-rc\.2/);
    assert.match(result[lang].latest, /2026-09-10.*DeepSeek-V4.1-Flash/);
    assert.match(result[lang].latest, /Prerelease|候选版/);
  }
});

test('npm and HF updates can lead, while undated tags cannot', () => {
  const sources = { releases: [{ date: 'n/a', title: 'unknown tag' }], npm: [{ date: '2026-10-01', title: 'v0.3.0' }] };
  assert.match(buildHighlights(sources).en.latest.split('\n')[0], /v0.3.0/);
  sources.hf = [{ date: '2026-10-02', title: 'deepseek-ai/New-Model' }];
  assert.match(buildHighlights(sources).en.latest.split('\n')[0], /New-Model/);
  assert.equal(buildHighlights({ releases: sources.releases }), null);
});
