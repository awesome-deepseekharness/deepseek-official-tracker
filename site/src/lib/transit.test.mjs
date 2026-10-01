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
// The version key is scoped by repository: an unscoped one shared by DeepSeek-V3
// and DeepSeek-R1, which both shipped v1.0.0, merged two model launches.
const kHarness = releaseKeys('deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2');
const kNpm = releaseKeys('v0.2.0-rc.2');
check('harness release yields a repo-scoped version key', kHarness.has('ver:deepseek-harness:v0.2.0-rc.2'), JSON.stringify([...kHarness]));
check('npm bare version yields the same version key', kNpm.has('ver:deepseek-harness:v0.2.0-rc.2'), JSON.stringify([...kNpm]));
check('harness+npm bridge on one key', [...kHarness].some(k => kNpm.has(k)));

// The date is part of the identity, so nine changelog entries all titled
// `deepseek-chat` stay nine steps instead of one step with five badges.
const kChatA = releaseKeys('deepseek-chat', '2025-03-24');
const kChatB = releaseKeys('deepseek-chat', '2024-12-10');
check('same title on different dates does not bridge',
  ![...kChatA].some(k => kChatB.has(k)), `${JSON.stringify([...kChatA])} vs ${JSON.stringify([...kChatB])}`);
check('same title on the same date does bridge',
  [...releaseKeys('deepseek-chat', '2025-03-24')].some(k => releaseKeys('deepseek-chat', '2025-03-24').has(k)));

// A dated weight drop is not its undated parent model.
const kDated = releaseKeys('deepseek-ai/DeepSeek-V4-Pro-0813');
const kParent = releaseKeys('deepseek-ai/DeepSeek-V4-Pro');
check('a dated weight drop is not its parent model',
  !kDated.has('model:v4-pro') && kDated.has('model:v4-pro-0813') && kParent.has('model:v4-pro'),
  JSON.stringify([...kDated]));

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

// --- one badge per source, never the same line twice ---------------------------
// The badge is the line identifier, so a duplicated badge reads as a rendering
// bug. These three were the causes: bare titles ignoring the date, an unscoped
// version key (V3 and R1 both shipped v1.0.0), and a model-stem key that
// swallowed the numeric suffix of a dated weight drop.
check('no stop lists one source line twice',
  stops.every(s => {
    const ids = s.sources.map(x => x.line);
    return ids.length === new Set(ids).size;
  }),
  (() => {
    const bad = stops.filter(s => s.sources.map(x => x.line).length !== new Set(s.sources.map(x => x.line)).size);
    return bad.map(s => `${s.date} ${s.name} [${s.sources.map(x => x.line).join(' ')}]`).join(' | ');
  })());

// Folding a line's extra entries into the tooltip must not lose them: the link is
// the product, so every source that reached the step has to stay named.
check('folded sources are still named in a tooltip',
  stops.every(s => s.sources.every(x => !x.also?.length || x.also.every(t => typeof t === 'string' && t.length > 0))));

// V3 and R1 are different products that happened to share a version number.
const v3 = stops.find(s => /DeepSeek-V3/.test(s.verbatim));
const r1 = stops.find(s => /DeepSeek-R1 release/.test(s.verbatim));
check('v1.0.0 did not weld V3 and R1 into one step',
  !!v3 && !!r1 && v3.id !== r1.id,
  `v3=${v3?.id} r1=${r1?.id}`);

// --- no scraper metadata presented as prose ------------------------------------
// huggingface.md writes the model card's own metadata row as the entry body and
// npm.md writes the dist-tag, so both reached the page as a summary: a model
// launch read "❤️ 3,748 · 📥 3,959,575 · text-generation · transformers, …".
check('no summary is a bare dist-tag',
  stops.every(s => !s.summary || !/^(latest|next|beta|canary|alpha)$/i.test(s.summary.trim())),
  stops.filter(s => /^(latest|next|beta|canary|alpha)$/i.test((s.summary || '').trim())).map(s => s.name).join(' | '));

check('no summary is a HuggingFace metadata row',
  stops.every(s => !s.summary || !/[\u2764\u2665]|\uD83D\uDCE5|safetensors|text-generation|region:us/.test(s.summary)),
  stops.filter(s => s.summary && /[\u2764\u2665]|\uD83D\uDCE5|safetensors|text-generation/.test(s.summary)).map(s => s.name).join(' | '));

// And the summary that should survive is still there: the blog post body is real
// prose and must not be filtered away with the metadata.
const flashStop = stops.find(s => /deepseek-v4\.1-flash/i.test(s.verbatim) && s.lines.includes('blog'));
check('real prose summaries survive the metadata filter',
  !!flashStop && /native visual understanding/i.test(flashStop.summary || ''),
  flashStop ? JSON.stringify((flashStop.summary || '').slice(0, 90)) : 'not found');

// A clipped summary ends on a word, not mid-token.
check('clipped summaries end at a word boundary',
  stops.every(s => !s.summary || !s.summary.endsWith('…') || /[\w)…]$/.test(s.summary)));

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

function releaseKeys(t, d) { return mReleaseKeys(t, d); }
