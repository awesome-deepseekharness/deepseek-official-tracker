import { spawn, spawnSync } from 'node:child_process';
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

export function rankFreeModels(models) {
  const freeCost = cost => cost && cost.input === 0 && cost.output === 0 &&
    Object.values(cost.cache || {}).every(value => value === 0) &&
    (!cost.context_over_200k || freeCost(cost.context_over_200k));
  return models.filter(model => freeCost(model.cost) && model.capabilities?.toolcall === true &&
    !['deprecated', 'retired'].includes(model.status) && /^[a-zA-Z0-9._-]+$/.test(model.id))
    .sort((a, b) => Number(b.capabilities.reasoning === true) - Number(a.capabilities.reasoning === true) ||
      (b.release_date || '').localeCompare(a.release_date || '') ||
      (b.limit?.context || 0) - (a.limit?.context || 0) || a.id.localeCompare(b.id));
}

export async function freeModels() {
  // Query metadata from the actual installed CLI and refresh models.dev each
  // run. No static IDs and no assumption that a '-free' suffix guarantees zero cost.
  for (const refresh of [true, false]) {
    const registry = spawnSync(process.env.OPENCODE_BIN || 'opencode',
      ['models', 'opencode', '--verbose', ...(refresh ? ['--refresh'] : [])], {
        encoding: 'utf8', shell: process.platform === 'win32', timeout: 30000,
        maxBuffer: 8 * 1024 * 1024,
      });
    if (registry.status !== 0) continue;
    const ranked = rankFreeModels(parseModelRegistry(registry.stdout));
    if (ranked.length) {
      console.log('[agent] Free tool-capable candidates:', ranked.map(m => `${m.id} (${m.release_date || 'date unknown'})`).join(', '));
      return ranked.map(model => model.id);
    }
  }
  throw new Error('No verifiably free tool-capable models available; retry required');
}

export async function runAgent({ agent, prompt, validate, beforeAttempt = () => {},
  timeoutMs = 240000, totalMs = 780000, maxAttempts = 12 }) {
  if (!['discover', 'review', 'triage'].includes(agent)) throw new Error('Unknown agent');
  const started = Date.now();
  const failures = [];
  for (const id of (await freeModels()).slice(0, maxAttempts)) {
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) continue;
    const remaining = totalMs - (Date.now() - started);
    if (remaining < 10000) break;
    await beforeAttempt();
    console.log(`[agent] ${agent}: trying opencode/${id}`);
    try {
      const output = await new Promise((resolve, reject) => {
        // Prompts go through stdin, never through a shell command string.
        const child = spawn(process.env.OPENCODE_BIN || 'opencode',
          ['run', '--format', 'json', '--model', `opencode/${id}`, '--agent', agent], {
            shell: process.platform === 'win32', stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, OPENCODE_CONFIG_CONTENT: JSON.stringify({ model: `opencode/${id}`, small_model: `opencode/${id}` }) },
          });
        let output = '';
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          forceKill = setTimeout(() => child.kill('SIGKILL'), 3000);
        }, Math.min(timeoutMs, remaining));
        let forceKill;
        const collect = chunk => { const text = chunk.toString(); output += text; process.stdout.write(text); };
        child.stdout.on('data', collect);
        child.stderr.on('data', collect);
        child.stdin.on('error', () => {});
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => {
          clearTimeout(timer); clearTimeout(forceKill);
          const error = outputError(output);
          if (timedOut || code !== 0 || error) reject(new Error(timedOut ? 'Timed out' : error || `Exit ${code}`));
          else resolve(output);
        });
        child.stdin.end(prompt);
      });
      const result = await validate(output);
      if (!result) throw new Error('Missing or invalid output artifact');
      return { model: id, result };
    } catch (error) {
      failures.push(`${id}: ${error.message}`);
      console.warn(`[agent] ${failures.at(-1)}`);
      if (error.code === 'ENOENT') break;
      await sleep(1000);
    }
  }
  throw new Error(`Agent unavailable or produced no valid result; retry required. ${failures.join(' | ')}`);
}
