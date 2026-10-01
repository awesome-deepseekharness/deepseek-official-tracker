#!/usr/bin/env node
/**
 * signals.mjs — the deterministic community/rumour layer
 *
 * Why this exists
 * ---------------
 * The repo has two news paths and only one of them actually updates:
 *
 *   1. track.mjs      — deterministic, official-only, commits to main every 6h.
 *   2. discover.mjs   — AI narrative into insights.md, gated behind a PR.
 *
 * Path 2 has been frozen since 2026-09-10: every discover PR since #19 was
 * closed rather than merged (the auto-reviewer treats a no-new-official-findings
 * draft as noise). So the only channel that holds community and rumour coverage
 * is the one channel nobody merges, which is why the tracker *looks* dead even
 * while 17 harness releases shipped underneath it.
 *
 * This script closes that gap without weakening the no-hallucination promise. It
 * is pure collection: corners.mjs already fetches every source and applies a
 * trust tier, so writing those tiers to a committed file needs no model at all.
 * The AI keeps writing the narrative in insights.md; this keeps the raw signal
 * table fresh and citable.
 *
 * What it writes: SIGNALS.md, grouped by trust tier, newest first, each row
 * carrying its own date, source and link. The `rumor` tier is rendered with an
 * explicit 疑似 / unverified stamp — speculation is recorded and dated, never
 * promoted into the official feed.
 *
 * Usage: node scripts/signals.mjs [--dry-run] [--limit N]
 * Requires: nothing. Every source is key-free.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSignals, loadSeen, saveSeen, SEEN_FILE } from './corners.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'SIGNALS.md');

// Only signal tiers. Official items already live in the numbered official files
// (api-changelog.md, releases.md, …) and duplicating them here would imply they
// need this file's weaker guarantees.
const SIGNAL_TIERS = ['rumor', 'community', 'secondary'];

const TIER_META = {
  rumor: {
    en: { heading: 'Rumours — unconfirmed speculation', stamp: 'unverified / 疑似' },
    zh: { heading: '传闻 — 未经官方确认', stamp: '未证实 / 疑似' },
  },
  community: {
    en: { heading: 'Community — leads, not proof', stamp: 'community' },
    zh: { heading: '社区讨论 — 仅供参考，未经证实', stamp: '社区' },
  },
  secondary: {
    en: { heading: 'Secondary — authoritative reporting, not first-party', stamp: 'media' },
    zh: { heading: '媒体报道 — 权威但非一手来源', stamp: '媒体' },
  },
};

// Rows kept per tier. Rumours age into noise fastest, so they get the smallest
// window; anything older than this stops being a leading indicator.
const TIER_LIMIT = { rumor: 20, community: 25, secondary: 25 };
const MAX_AGE_DAYS = 30;

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function escapeCell(s) {
  // These strings come from third-party feeds and land inside a markdown table,
  // so a pipe or a newline in a headline would otherwise break the whole table.
  return String(s || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFresh(date) {
  return date && date >= daysAgo(MAX_AGE_DAYS);
}

/**
 * Group signals into the rows we render. Exported for testing against fixtures,
 * because the sorting and de-duplication rules are where this file can quietly
 * go wrong: an out-of-order table reads as a tracker that lost track.
 */
export function buildRows(signals, { limit = TIER_LIMIT } = {}) {
  const out = {};
  for (const tier of SIGNAL_TIERS) out[tier] = [];

  for (const s of signals) {
    if (!SIGNAL_TIERS.includes(s.tier)) continue;
    if (!s.url || !s.title) continue;
    if (!isFresh(s.date)) continue;

    // Same headline from two outlets is corroboration, not two signals. Key on
    // the normalised title rather than the URL so a syndicated copy collapses.
    const key = `${s.tier}|${escapeCell(s.title).toLowerCase().slice(0, 70)}`;
    const existing = out[s.tier].find((r) => r.key === key);
    if (existing) {
      if (!existing.detail && s.detail) existing.detail = s.detail;
      continue;
    }
    out[s.tier].push({
      key,
      tier: s.tier,
      date: s.date,
      title: escapeCell(s.title),
      source: escapeCell(s.source),
      detail: escapeCell(s.detail).slice(0, 220),
      url: s.url,
      isNew: s.isNew === true,
    });
  }

  // Newest first; undated rows sink, then ties break on title so repeated runs
  // produce byte-identical output and the repo does not churn.
  for (const tier of SIGNAL_TIERS) {
    out[tier].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
    out[tier] = out[tier].slice(0, limit[tier]);
  }
  return out;
}

function renderTable(rows, tier) {
  if (!rows.length) return '_No signals captured in this window._\n';
  const meta = TIER_META[tier];
  const lines = [
    `### ${meta.en.heading} · <span title="${meta.en.stamp}">${meta.en.stamp}</span>`,
    '',
    `| ${rows.some(r => r.isNew) ? 'New | ' : ''}Date | Source | Signal |`,
    `|---|---|---|`,
  ];
  for (const r of rows) {
    const detail = r.detail ? ` — ${r.detail}` : '';
    lines.push(
      `| ${r.isNew ? '🆕 | ' : ''}${r.date} | ${r.source} | [${r.title}](${r.url})${detail} |`
    );
  }
  return `${lines.join('\n')}\n`;
}

function render(rows, { freshCount, cornerErrors, seenCount }) {
  const now = new Date().toISOString();
  const total = SIGNAL_TIERS.reduce((n, t) => n + rows[t].length, 0);

  const parts = [
    '# Signals — Community, Media & Rumour',
    '',
    `> Auto-generated by \`scripts/signals.mjs\` from \`scripts/corners.mjs\` — last run: ${now} (UTC).`,
    '>',
    `> ${freshCount} new signal(s) vs ${seenCount} already seen. ${total} shown below.`,
    '>',
    '> **These are not official DeepSeek updates.** Nothing here is a release. The',
    '> official record is [FEED.md](FEED.md); verified findings are in',
    '> [insights.md](insights.md). Each tier states how far it can be trusted, and',
    '> every row links to its own source so you can check it in one click.',
    '>',
    '> Written deterministically with no LLM in the loop — same inputs, same file.',
    '',
  ];

  if (cornerErrors.length) {
    parts.push(
      `> ⚠️ ${cornerErrors.length} source(s) failed this run, so this table is incomplete:`,
      ...cornerErrors.map((e) => `> - ${e}`),
      '>',
      ''
    );
  }

  for (const tier of SIGNAL_TIERS) parts.push(renderTable(rows[tier], tier));

  parts.push(
    '---',
    '',
    '## How to read this',
    '',
    '| Tier | Means | Safe to assert? |',
    '|---|---|---|',
    '| `rumor` | Speculation about work DeepSeek has **not** announced | No — 疑似 / unverified. Quote as a rumour with its date. |',
    '| `community` | HN / Reddit / X / V2EX / third-party GitHub repos | No — leads, does not prove. |',
    '| `secondary` | Established tech media, arXiv, OpenRouter | Authoritative, but still not first-party. |',
    '',
    'A signal becomes official when it appears on a first-party surface —',
    '`deepseek.com`, `api-docs.deepseek.com`, `github.com/deepseek-ai`,',
    '`huggingface.co/deepseek-ai`, `npmjs.com/package/@deepseek-ai`.',
    'Until then it stays here.',
    '',
    `*Generated by scripts/signals.mjs at ${now} UTC. No affiliation with DeepSeek.*`,
    ''
  );

  return parts.join('\n');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : null;

  console.log(`[signals] collecting corners…`);
  let corners = { signals: [], errors: [] };
  try {
    corners = await collectSignals();
  } catch (e) {
    console.warn(`[signals] collection failed: ${e.message}`);
  }
  console.log(`[signals] ${corners.signals.length} signals, ${corners.errors.length} corner error(s)`);
  if (corners.errors.length) console.warn(`[signals] errors: ${corners.errors.join(' | ')}`);

  const seen = loadSeen();
  // Mark freshness against the same baseline discover.mjs uses, so the 🆕 column
  // agrees with what the discover agent was told about.
  for (const s of corners.signals) s.isNew = !seen.ids.has(s.id);
  const freshCount = corners.signals.filter((s) => s.isNew).length;

  const rows = buildRows(corners.signals, limit ? Object.fromEntries(Object.entries(TIER_LIMIT).map(([k, v]) => [k, Math.min(v, limit)])) : {});
  const md = render(rows, { freshCount, cornerErrors: corners.errors, seenCount: seen.ids.size });

  if (dryRun) {
    console.log(`[signals] --dry-run: would write ${md.length} chars to SIGNALS.md (not written)`);
    for (const tier of SIGNAL_TIERS) console.log(`  ${tier}: ${rows[tier].length}`);
    return;
  }

  const prev = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
  // Only the header carries a timestamp. If the rows are unchanged, keep the
  // file byte-for-byte so an unchanged day produces no empty commit — the same
  // no-churn rule health.mjs and track.mjs both follow.
  const stripStamp = (s) => s.replace(/last run: [^\n)]*\)/, 'last run: —)');
  if (prev && stripStamp(prev) === stripStamp(md)) {
    console.log(`[signals] no new signals — SIGNALS.md unchanged (no churn)`);
  } else {
    fs.writeFileSync(OUT_FILE, md, 'utf8');
    console.log(`[signals] wrote SIGNALS.md (${md.length} chars)`);
    for (const tier of SIGNAL_TIERS) console.log(`  ${tier}: ${rows[tier].length}`);
  }

  // Advance the baseline only for signal tiers. Official ids are discover.mjs's
  // business; recording them here would make the next discover run think they
  // were already reported and skip them.
  const signalIds = corners.signals.filter((s) => SIGNAL_TIERS.includes(s.tier)).map((s) => s.id);
  saveSeen([...seen.ids, ...signalIds], {
    lastSignalsRunAt: new Date().toISOString(),
    lastFreshCount: freshCount,
    cornerErrors: corners.errors,
  });
  console.log(`[signals] baseline ${path.relative(ROOT, SEEN_FILE)} now ${seen.ids.size + signalIds.length} ids`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}