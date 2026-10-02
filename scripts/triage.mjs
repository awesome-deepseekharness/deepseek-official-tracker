import { execFileSync } from 'node:child_process';
import { runAgent } from './opencode-runner.mjs';
const number = process.env.ISSUE_NUMBER;
if (!/^\d+$/.test(number || '')) throw new Error('ISSUE_NUMBER must be numeric');
const comments = () => JSON.parse(execFileSync('gh', ['issue', 'view', number, '--json', 'comments'], { encoding: 'utf8' })).comments;
const before = new Set(comments().map(comment => comment.id));
await runAgent({
  agent: 'triage', prompt: `Triage issue #${number} using the agent instructions. Verify sources, act within the allowed scope and post the diagnosis.`,
  validate: () => comments().some(comment => !before.has(comment.id) && ['github-actions[bot]', 'app/github-actions'].includes(comment.author.login)),
});
