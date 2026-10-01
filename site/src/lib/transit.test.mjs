import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINES, parseSourceFile, buildNetwork, lineTotals, parseSignals, parseFeedStamp, releaseKeys as mReleaseKeys } from './transit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`ok   ${name}`);
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

// --- releaseKeys against real observed titles -------------------------------
// releaseKeys returns a Set; compare with .has()
const kHarness = releaseKeys('deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2');
const kNpm = releaseKeys('v0.2.0-rc.2');
check('harness release yields a version key', kHarness.has('ver:v0.2.0-rc.2'), JSON.stringify([...kHarness]));
check('npm bare version yields same version key', kNpm.has('ver:v0.2.0-rc.2'), JSON.stringify([...kNpm]));
check('harness+npm bridge on one key', [...kHarness].some(k => kNpm.has(k)));

const kHf = releaseKeys('deepseek-ai/DeepSeek-V4.1-Flash');
check('HF model slug yields model key', kHf.has('model:v4.1-flash'), JSON.stringify([...kHf]));
const kBlog = releaseKeys('Introducing DeepSeek-V4.1-Flash: smarter, faster, more efficient.');
check('blog title bridges to HF model key', kBlog.has('model:v4.1-flash'), JSON.stringify([...kBlog]));

// CRLF is the reason this file exists as a test: a Windows checkout silently
// yields zero stations from every source file without the normalisation.
const crlf = read('npm.md').replace(/\r\n/g, '\n');
check('CRLF fixture parses identically to LF', parseSourceFile(crlf, 'npm').length === parseSourceFile(read('npm.md'), 'npm').length);

// --- build against the real repo files ---------------------------------------
const perLine = LINES.map(l => parseSourceFile(read(l.file), l.id));
const counts = perLine.map((s, i) => `${LINES[i].id}=${s.length}`).join(' ');
console.log(`\nparsed: ${counts}`);

const stops = buildNetwork(perLine);
const totals = lineTotals(stops);
console.log(`stops: ${stops.length}  interchanges: ${stops.filter(s => s.interchange).length}`);
console.log(`totals: ${JSON.stringify(totals)}`);

check('every line contributed at least one station', Object.values(totals).every(v => v > 0), JSON.stringify(totals));
check('dated stops sort newest first', (() => {
  const d = stops.filter(s => s.date !== 'n/a').map(s => s.date);
  return d.every((v, i) => i === 0 || d[i - 1] >= v);
})());
check('undated stops sink to the bottom', stops.findIndex(s => s.date !== 'n/a') < stops.findIndex(s => s.date === 'n/a') || !stops.some(s => s.date === 'n/a'));
check('interchanges really span 2+ lines', stops.filter(s => s.interchange).every(s => s.lines.length > 1));
check('every stop carries at least one source link', stops.every(s => s.sources.length > 0));
const harnessStop = stops.find(s => /0\.2\.0-rc\.2/.test(s.verbatim));
check('harness release became a github+npm interchange',
  !!harnessStop && harnessStop.interchange && harnessStop.lines.includes('github') && harnessStop.lines.includes('npm'),
  harnessStop ? JSON.stringify({ lines: harnessStop.lines, name: harnessStop.name }) : 'not found');
check('station name is reader-facing, verbatim kept alongside',
  !!harnessStop && harnessStop.name === 'DeepSeek Harness v0.2.0-rc.2'
    && harnessStop.verbatim === 'deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2',
  harnessStop ? JSON.stringify({ name: harnessStop.name, verbatim: harnessStop.verbatim }) : '');
check('no station echoes its own version as a summary',
  stops.every(s => !s.summary || s.summary.toLowerCase().replace(/^v/, '') !== s.name.toLowerCase().match(/v\d[\w.+-]*/)?.[0]?.replace(/^v/, '')));

console.log('\nnewest stops:');
for (const s of stops.slice(0, 5)) {
  console.log(`  ${s.date}  ${s.interchange ? 'INTERCHANGE' : '  stop    '}  [${s.lines.join(',')}]`);
  console.log(`             ${s.name.slice(0, 74)}`);
}

// --- signals -----------------------------------------------------------------
const sigs = parseSignals(read('insights.md'));
console.log(`\nsignals: ${sigs.length} (secondary=${sigs.filter(s => s.tier === 'secondary').length} community=${sigs.filter(s => s.tier === 'community').length})`);
check('insights signals extracted', sigs.length > 0);
check('signals all carry a url', sigs.every(s => s.url.startsWith('http')));
check('no verified findings leaked into signals', sigs.every(s => /Secondary|Community/.test(s.section)));
check('no non-signal sections swallowed', !sigs.some(s => /Risk|Next steps|Trends|Cross-check/i.test(s.title)));

console.log(fail ? `\n${fail} failure(s)` : '\ntransit model OK');
process.exit(fail ? 1 : 0);

function releaseKeys(t) { return mReleaseKeys(t); }
