import { spawn } from 'node:child_process';
import fs from 'node:fs';

// Measure the real layout with Chrome DevTools Protocol rather than eyeballing a
// screenshot. The mobile capture showed text clipped mid-word and the source
// roster's counts missing, which is the signature of horizontal overflow — but
// "looks too wide" is not a diagnosis. This reports the exact overflowing
// elements and by how much, at several widths, so the fix targets the culprit
// instead of the symptom.

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL_ = process.argv[2] || 'http://127.0.0.1:4173/';
const PORT = 9333;

const widths = [390, 768, 1080, 1280, 1440, 1600];
const probe = fs.readFileSync(new URL('./cdp-probe.js', import.meta.url), 'utf8');

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + fs.mkdtempSync('cdp-'),
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('devtools never came up');
}

const page = await targets();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pending.set(n, { res, rej });
  ws.send(JSON.stringify({ id: n, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');

const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};

for (const w of widths) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700,
  });
  await send('Page.navigate', { url: URL_ });
  await sleep(1400);
  const out = await evaluate(`(() => { ${probe} })()`);
  const flag = out.scrollWidth > out.clientWidth + 1 ? '  <-- OVERFLOW' : '';
  console.log(`\n=== ${w}px === viewport ${out.clientWidth}  scrollWidth ${out.scrollWidth}${flag}`);
  for (const n of out.note || []) console.log(`  note: ${n}`);
  if (out.overflowing.length) {
    console.log('  culprits:');
    for (const o of out.overflowing) {
      console.log(`    +${o.worst}px  box ${o.width}px  ${o.sel}   [${o.why}]`);
    }
  }
}

ws.close();
chrome.kill();
process.exit(0);