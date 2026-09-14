import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficialRepos, findCandidates, insertReposSorted, syncRepoCounts } from './scope-watch.mjs';

const NOW = new Date('2026-09-14T00:00:00Z').getTime();
const fresh = new Date(NOW - 5 * 24 * 3600 * 1000).toISOString();
const stale = new Date(NOW - 400 * 24 * 3600 * 1000).toISOString();

test('parseOfficialRepos extracts quoted entries', () => {
  const src = `const OFFICIAL_REPOS = [\n  'a/b',\n  "c/d",\n];`;
  assert.deepEqual(parseOfficialRepos(src), ['a/b', 'c/d']);
});

test('parseOfficialRepos throws when block missing', () => {
  assert.throws(() => parseOfficialRepos('nope'), /OFFICIAL_REPOS/);
});

test('findCandidates keeps only new, active, non-fork, non-archived repos', () => {
  const org = [
    { full_name: 'deepseek-ai/NewHot', fork: false, archived: false, pushed_at: fresh, stargazers_count: 9, description: 'x', html_url: '' },
    { full_name: 'deepseek-ai/Old', fork: false, archived: false, pushed_at: stale },
    { full_name: 'deepseek-ai/Forked', fork: true, archived: false, pushed_at: fresh },
    { full_name: 'deepseek-ai/Dead', fork: false, archived: true, pushed_at: fresh },
    { full_name: 'deepseek-ai/Tracked', fork: false, archived: false, pushed_at: fresh },
    { full_name: 'deepseek-ai/.github', fork: false, archived: false, pushed_at: fresh },
  ];
  const out = findCandidates(org, ['deepseek-ai/Tracked'], NOW);
  assert.deepEqual(out.map((c) => c.repo), ['deepseek-ai/NewHot']);
});

test('findCandidates is a no-op on rate-limit-shaped garbage', () => {
  assert.deepEqual(findCandidates(null, ['a/b'], NOW), []);
  assert.deepEqual(findCandidates({ message: 'rate limited' }, ['a/b'], NOW), []);
});

test('insertReposSorted merges + sorts, idempotent on re-run', () => {
  const src = `const OFFICIAL_REPOS = [\n  'deepseek-ai/b',\n];\n`;
  const once = insertReposSorted(src, ['deepseek-ai/a']);
  assert.ok(once.indexOf("'deepseek-ai/a'") < once.indexOf("'deepseek-ai/b'"));
  const twice = insertReposSorted(once, ['deepseek-ai/a']);
  assert.equal(twice, once);
});

test('syncRepoCounts rewrites EN+ZH counts', () => {
  const [en, zh] = syncRepoCounts(
    'x 25 repos: `DeepSeek-V3` y (25 today) z',
    'x 25 个仓库：`DeepSeek-V3` y（目前 25 个）z',
    26
  );
  assert.ok(en.includes('26 repos: `DeepSeek-V3`') && en.includes('(26 today)'));
  assert.ok(zh.includes('26 个仓库：`DeepSeek-V3`') && zh.includes('（目前 26 个）'));
});
