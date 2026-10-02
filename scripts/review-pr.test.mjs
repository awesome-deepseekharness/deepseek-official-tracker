import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trustedDraft, validDecision, reviewIsCurrent } from './review-pr.mjs';

test('stale PR base metadata does not block merging, but changed live revisions do', () => {
  const pr = { head: { sha: 'reviewed-draft' }, base: { sha: 'old-pr-base' } };
  assert.equal(reviewIsCurrent(pr, 'reviewed-draft', 'main-now', 'main-now'), true);
  assert.equal(reviewIsCurrent(pr, 'reviewed-draft', 'new-main', 'main-now'), false);
  assert.equal(reviewIsCurrent({ ...pr, head: { sha: 'new-draft' } },
    'reviewed-draft', 'main-now', 'main-now'), false);
});

test('review only accepts the bot insights-only PR from this repository', () => {
  const repo = 'owner/tracker';
  const pr = { state: 'open', user: { login: 'github-actions[bot]' }, base: { ref: 'main' }, head: { ref: 'discover/insights', repo: { full_name: repo } } };
  const files = [{ filename: 'insights.md', status: 'modified' }];
  assert.equal(trustedDraft(pr, files, repo), true);
  assert.equal(trustedDraft(pr, [...files, { filename: 'opencode.json', status: 'modified' }], repo), false);
  assert.equal(trustedDraft({ ...pr, user: { login: 'stranger' } }, files, repo), false);
  assert.equal(trustedDraft({ ...pr, head: { ...pr.head, repo: { full_name: 'fork/tracker' } } }, files, repo), false);
});
test('merge decisions bind verified evidence to the reviewed head and cited URLs', () => {
  const draft = '[Source](https://example.com/news)';
  const decision = { decision: 'MERGE', head_sha: 'abc', confidence: 'high', reason: 'New attributed community evidence.', new_information: 'A dated discussion absent from the prior report.', sources: [{ url: 'https://example.com/news', evidence: 'The fetched source supports the attributed claim.' }] };
  assert.equal(validDecision(decision, 'abc', draft), true);
  assert.equal(validDecision(decision, 'changed', draft), false);
  assert.equal(validDecision({ ...decision, confidence: 'low' }, 'abc', draft), false);
  assert.equal(validDecision({ ...decision, sources: [] }, 'abc', draft), false);
  assert.equal(validDecision(decision, 'abc', 'Unrelated content'), false);
  assert.equal(validDecision({ ...decision, sources: [...decision.sources,
    { url: 'https://api.example.com/news/1', evidence: 'The source API independently confirms the original publication date.' },
  ] }, 'abc', draft), true);
});
