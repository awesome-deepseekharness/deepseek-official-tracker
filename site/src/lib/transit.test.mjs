import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINES, parseSourceFile, buildNetwork, lineTotals, parseSignals, parseSignalTables, parseFeedStamp, magnitudeOf, weeklyCadence, releaseKeys as mReleaseKeys } from './transit.mjs';

// The page bands magnitude into three weights so rank reads without colour.
// Duplicated here rather than imported so a change to the page's banding cannot
// silently satisfy the data model's own test.
const magBandFor = n => (n >= 3 ? 'bright' : n === 2 ? 'mid' : 'faint');

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
const wrapped = parseSignals('## Secondary signals\n- **Desktop hands-on** (2026-09-30)\n  A report with a wrapped citation.\n  [Source](https://example.com/desktop)\n- **Second report** (2026-10-01) [Source](https://example.com/second)\n## New findings\n- **Official** [Source](https://example.com/official)');
check('wrapped bullet citations remain visible and do not merge neighbouring entries',
  wrapped.length === 2 && wrapped[0].title === 'Desktop hands-on' && wrapped[0].url === 'https://example.com/desktop' && wrapped[1].title === 'Second report');

// --- SIGNALS.md tables -------------------------------------------------------
// The strip's primary source, and the only one that refreshes on a fixed
// cadence. If this parser silently returns [] the strip empties with no error,
// which is the same class of bug the CRLF fixture above exists to catch.
const tableSigs = parseSignalTables(read('SIGNALS.md'));
console.log(`\nSIGNALS.md rows: ${tableSigs.length} (rumor=${tableSigs.filter(s => s.tier === 'rumor').length} community=${tableSigs.filter(s => s.tier === 'community').length} secondary=${tableSigs.filter(s => s.tier === 'secondary').length})`);
check('SIGNALS.md rows extracted', tableSigs.length > 0);
check('SIGNALS rows all carry a url', tableSigs.every(s => s.url.startsWith('http')));
check('SIGNALS rows all carry a valid date', tableSigs.every(s => /^\d{4}-\d{2}-\d{2}$/.test(s.date)));
check('every tier is one of the three signal tiers',
  tableSigs.every(s => ['rumor', 'community', 'secondary'].includes(s.tier)),
  JSON.stringify([...new Set(tableSigs.map(s => s.tier))]));
check('the trailing "How to read this" table is not parsed as signals',
  !tableSigs.some(s => /not official DeepSeek updates|first-party surface/i.test(s.title)));
check('no official releases leaked into the signal tiers',
  !tableSigs.some(s => /^deepseek-ai\/deepseek-harness release/.test(s.title)),
  tableSigs.find(s => /^deepseek-ai\//.test(s.title))?.title || '');
check('rumour tier carries the 疑似 / unverified stamp in its section',
  tableSigs.filter(s => s.tier === 'rumor').every(s => /rumou?r|rumour/i.test(s.section)),
  JSON.stringify(tableSigs.filter(s => s.tier === 'rumor').map(s => s.section)));

// Regression: the 🆕 column sits between two pipes, so a fresh row is
// "| 🆕 | 2026-09-22 | Source | …". A row matcher that goes straight from the
// closing pipe to \d{4} skips every fresh row — i.e. most of them on a busy
// day — and returns a plausible short list rather than an error. Pinned here
// because the real SIGNALS.md cannot cover both shapes on every run.
const freshRow = '| 🆕 | 2026-09-22 | Rumour wire | [something leaked](https://example.com/a) — detail |';
const quietRow = '| 2026-09-21 | 量子位 | [a report](https://example.com/b) — detail |';
const fixture = `### Rumours — unconfirmed speculation\n\n| New | Date | Source | Signal |\n|---|---|---|---|\n${freshRow}\n${quietRow}\n`;
const fx = parseSignalTables(fixture);
check('both 🆕 and quiet rows parse', fx.length === 2, `got ${fx.length}`);
check('🆕 row is flagged new', fx[0]?.isNew === true && fx[0]?.date === '2026-09-22' && fx[0]?.source === 'Rumour wire',
  JSON.stringify(fx[0] || null));
check('quiet row is not flagged new', fx[1]?.isNew === false && fx[1]?.source === '量子位',
  JSON.stringify(fx[1] || null));
check('fixture rows classified as rumour tier', fx.every(s => s.tier === 'rumor'));

if (tableSigs.length) {
  console.log('newest signals:');
  for (const s of tableSigs.slice(0, 5)) console.log(`  ${s.date}  ${s.tier.padEnd(9)}  ${s.source.slice(0, 18).padEnd(18)}  ${s.title.slice(0, 60)}`);
}

// --- magnitude & cadence -----------------------------------------------------
// Both were shipped untested once and the cadence strip rendered sixteen empty
// columns captioned "0 releases in 16 weeks" — the one element whose whole job
// is proving the tracker is alive, confidently reporting that nothing was.

const two = { date: '2026-09-29', lines: ['github', 'npm'] };
const one = { date: '2026-09-29', lines: ['github'] };

check('magnitude: more sources means a lower (brighter) magnitude',
  magnitudeOf({ date: '2026-09-29', lines: ['blog', 'api', 'hf'] }).value < magnitudeOf(two).value);
check('magnitude: two sources is mid-banded', magnitudeOf(two).value === 4.3 && magBandFor(2) === 'mid',
  JSON.stringify(magnitudeOf(two)));
check('magnitude: one source is faint-banded', magBandFor(1) === 'faint');
check('magnitude: three sources is bright-banded', magBandFor(3) === 'bright');
check('magnitude: duplicate line ids count once', magnitudeOf({ date: 'x', lines: ['github', 'github'] }).sources === 1);
check('undated entries get no magnitude at all', magnitudeOf({ date: 'n/a', lines: ['github', 'npm'] }) === null);

const cad = weeklyCadence([
  { date: '2026-09-29', lines: ['github', 'npm'] },
  { date: '2026-09-30', lines: ['github'] },
  { date: '2026-09-28', lines: ['github', 'npm'] },
  { date: '2026-07-01', lines: ['github'] },
], { weeks: 16 });
check('cadence: returns the requested number of weeks', cad.length === 16, `got ${cad.length}`);
check('cadence: the busiest week is not empty', cad.some(w => w.count > 0), 'all weeks empty');
check('cadence: counts add up to every dated stop in range',
  cad.reduce((n, w) => n + w.count, 0) === 4, `got ${cad.reduce((n, w) => n + w.count, 0)}`);
check('cadence: empty weeks are present rather than skipped',
  cad.some(w => w.count === 0), 'no quiet week emitted');
check('cadence: oldest first, newest last',
  cad.every((w, i) => i === 0 || cad[i - 1].weekStart < w.weekStart));
check('cadence: every bucket is a Monday', cad.every(w => new Date(`${w.weekStart}T00:00:00Z`).getUTCDay() === 1),
  cad.filter(w => new Date(`${w.weekStart}T00:00:00Z`).getUTCDay() !== 1).map(w => w.weekStart).join(','));
check('cadence: the strongest release in a week is reported',
  cad.some(w => w.strongest && w.strongestSources >= 2), 'no multi-source week found');
check('cadence: real repo data produces a populated strip',
  weeklyCadence(stops, { weeks: 16 }).some(w => w.count > 0), 'strip would render empty');

console.log(fail ? `\n${fail} failure(s)` : '\ntransit model OK');
process.exit(fail ? 1 : 0);

function releaseKeys(t) { return mReleaseKeys(t); }
