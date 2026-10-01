/**
 * kitesurf-probe.mjs — is the remote browser actually usable?
 *
 * Kitesurf is explicitly experimental, and its endpoint already changed host
 * once: `wss://kitesurf.cloudflare.app` now completes TCP and TLS but answers
 * CDP with a non-101 status, so it looks configured and fails every call. The
 * Discover prompt used to recommend it as a primary tool with nothing checking,
 * which is how a dead browser cost real budget.
 *
 * This does one WebSocket handshake plus one Target.getTargets call. That is
 * cheap enough to run on every discover pass, and it answers the only question
 * that matters: can an agent drive this thing.
 *
 * Exit 0 = usable, 1 = not. Prints one line either way.
 */

const ENDPOINTS = [
  // Cloudflare's stateless browser on Workers. No account, no token, so this is
  // what the repo's opencode.json points at and what CI can verify.
  'wss://kitesurf.dev/devtools/browser',
];

export async function probeBrowser(timeoutMs = 15000) {
  for (const endpoint of ENDPOINTS) {
    let ws;
    try {
      ws = new WebSocket(endpoint);
      const opened = await Promise.race([
        new Promise((res, rej) => {
          ws.addEventListener('open', () => res(true), { once: true });
          ws.addEventListener('error', () => rej(new Error('socket error')), { once: true });
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('handshake timeout')), timeoutMs)),
      ]);
      if (!opened) throw new Error('handshake failed');

      const result = await Promise.race([
        new Promise((res, rej) => {
          ws.addEventListener('message', ev => {
            const m = JSON.parse(ev.data);
            if (m.id === 1) m.error ? rej(new Error(m.error.message)) : res(m.result);
          });
          ws.send(JSON.stringify({ id: 1, method: 'Target.getTargets' }));
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('CDP call timeout')), timeoutMs)),
      ]);
      return { endpoint, ok: true, targets: result.targetInfos?.length ?? 0 };
    } catch (e) {
      return { endpoint, ok: false, error: e.message };
    } finally {
      try { ws?.close(); } catch { /* already closed */ }
    }
  }
  return { endpoint: ENDPOINTS[0], ok: false, error: 'no endpoints configured' };
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const r = await probeBrowser();
  if (r.ok) {
    console.log(`[browser] ${r.endpoint} usable (${r.targets} targets)`);
    process.exit(0);
  }
  console.log(`[browser] ${r.endpoint} UNUSABLE: ${r.error}`);
  process.exit(1);
}
