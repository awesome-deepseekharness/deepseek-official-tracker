import { spawn, spawnSync } from 'node:child_process';
import { withFreeModel } from './opencode-free.mjs';
import { setTimeout as sleep } from 'node:timers/promises';

export function outputError(output) {
  for (const line of output.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'error' || event.error) return JSON.stringify(event.error || event);
    } catch { /* Non-JSON progress output. */ }
  }
  return /(?:^|\n)(?:\x1b\[[0-9;]*m)*Error:\s/m.test(output) ? 'OpenCode reported an error' : null;
}

export function parseModelRegistry(output) {
  const headers = [...output.matchAll(/^opencode\/([^\s]+)\r?\n/gm)];
  return headers.flatMap((header, index) => {
    try {
      return [JSON.parse(output.slice(header.index + header[0].length, headers[index + 1]?.index).trim())];
    } catch { return []; }
  });
}

// Vendor preference is a deliberate trust policy, not a capability claim.
// Prefer model families with a reliable history in this automation before a
// newer release from a vendor with no track record. Within a vendor, the
// newest release wins; outside the list, release date decides.
export { TRUSTED_FREE_MODEL_VENDORS, rankFreeModels } from './opencode-free.mjs';

export async function runAgent({ agent, prompt, validate, beforeAttempt = () => {},
  timeoutMs = 240000, totalMs = 780000 }) {
  if (!['discover', 'review', 'triage'].includes(agent)) throw new Error('Unknown agent');
  // Dual-rail free-model traversal: the OpenCode Zen public catalog first, then
  // the Kilo CLI free catalog as a fallback when Zen is exhausted on runner IPs.
  const { model, result } = await withFreeModel(async (fullID, attemptMs, run) => {
    await beforeAttempt();
    const output = await run(fullID, prompt, { agent, timeoutMs: attemptMs });
    const result = await validate(output);
    if (!result) throw new Error('Missing or invalid output artifact');
    return result;
  }, { totalMs, attemptMs: timeoutMs });
  return { model, result };
}
