import { parseSourceFile } from 'file:///C:/Users/runneradmin/Desktop/deepseek-official-tracker/site/src/lib/transit.mjs';

// [line, date, title, body] — bodies that must survive the metadata filter.
const KEEP = [
  ['api', '2026-12-01', 'DeepSeek-V3.2 Release', 'The DeepSeek-V3.2 release introduces enhanced reasoning and thinking within tool-use, as well as gold-medal performance in IMO, CMO, ICPC and OI competitions.'],
  ['blog', '2024-12-26', 'Introducing DeepSeek-V3', 'DeepSeek-V3 launches with 671B MoE parameters, 3x faster generation at 60 tokens/second, enhanced capabilities, and fully open-source models and papers.'],
  ['news', '2024-06-14', 'DeepSeek API Update', 'The DeepSeek API has been upgraded. JSON mode, function calling and more are available on the chat endpoint.'],
  ['github', '2026-09-29', 'deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2', 'Fixes a crash on Windows checkouts and updates the embedded harness runtime.'],
];

// Bodies that must be dropped: scraper metadata, dist-tags, tag lists.
const DROP = [
  ['latest', 'npm dist-tag'],
  ['next', 'npm dist-tag'],
  ['\u2764 765 \u00b7 \ud83d\udce5 90,822 \u00b7 text-generation \u00b7 transformers, safetensors, deepseek_v4', 'HF metadata row'],
  ['\u2764 12 \u00b7 \ud83d\udce5 338 \u00b7 model \u00b7 safetensors, gemma4_unified_text, region:us', 'HF metadata row'],
  ['1,151 \u00b7 1,106 \u00b7 model \u00b7 safetensors, qwen3, region:us', 'HF row, leading emoji stripped'],
  ['safetensors, qwen3, region:us', 'bare tag list'],
  ['transformers, safetensors, deepseek_v4, text-generation, conversational', 'bare tag list'],
];

const md = (date, title, body) =>
  `## [${date}] ${title}\n\n${body}\n\n[Source](https://example.com/x)\n\n---\n\n`;

let fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) console.log(`ok   ${n}`);
  else { fail++; console.log(`FAIL ${n} ${extra}`); }
};

for (const [line, date, title, body] of KEEP) {
  const s = parseSourceFile(md(date, title, body), line)[0];
  check(`keeps real prose (${line})`, s?.summary === body, JSON.stringify(s?.summary));
}

for (const [body, label] of DROP) {
  const s = parseSourceFile(md('2026-09-29', 'Some Title', body), 'api')[0];
  check(`drops ${label}`, s?.summary === '', JSON.stringify(s?.summary));
}

// The keep-checks must be reading a body at all, or they pass vacuously.
const probe = parseSourceFile(md('2026-09-29', 'Some Title', 'A real sentence about the release.'), 'api')[0];
check('probe body is actually parsed', probe?.summary === 'A real sentence about the release.', JSON.stringify(probe?.summary));

// A long body clips at a word, with an ellipsis that says so.
const long = 'word '.repeat(80).trim();
const clipped = parseSourceFile(md('2026-09-29', 'Some Title', long), 'api')[0].summary;
check('long body is clipped', clipped.length <= 221 && clipped.endsWith('\u2026'), `len=${clipped.length}`);
check('clip lands on a whole word', /\w\u2026$/.test(clipped) && !/wor\u2026$/.test(clipped), JSON.stringify(clipped.slice(-24)));

// The body track.mjs now writes for a HuggingFace entry must survive: a filter
// tuned on today's junk would otherwise silence every future real body too.
const hfBody = 'Pipeline: text-generation. Paper: arxiv:2606.19348.';
const hf = parseSourceFile(md('2026-08-13', 'deepseek-ai/DeepSeek-V4-Flash-0731', hfBody), 'hf')[0];
check('keeps the new HF summary track.mjs writes', hf?.summary === hfBody, JSON.stringify(hf?.summary));

console.log(fail ? `\n${fail} failure(s)` : '\nsummary filter OK');
process.exit(fail ? 1 : 0);
