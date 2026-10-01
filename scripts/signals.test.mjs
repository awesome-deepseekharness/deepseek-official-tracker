import { buildRows } from './signals.mjs';

// SIGNALS.md is the only channel that always updates, so its two failure modes
// are both silent: rows out of order (reads as a tracker that lost track) and
// the same headline counted twice (reads as corroboration that does not exist).
// Both are cheap to test and expensive to notice in production.

let fail = 0;
const ok = (cond, label) => {
  if (cond) console.log(`ok   ${label}`);
  else { fail++; console.log(`FAIL ${label}`); }
};

const iso = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

// --- ordering -------------------------------------------------------------
const ordered = buildRows([
  { tier: 'secondary', date: iso(1), title: 'newer', source: 's', url: 'u1' },
  { tier: 'secondary', date: iso(9), title: 'older', source: 's', url: 'u2' },
  { tier: 'secondary', date: iso(4), title: 'middle', source: 's', url: 'u3' },
]);
ok(
  ordered.secondary.map(r => r.title).join(',') === 'newer,middle,older',
  `newest first (got ${ordered.secondary.map(r => r.title).join(',')})`
);

// --- stability across repeated runs --------------------------------------
const twice = buildRows([
  { tier: 'community', date: iso(2), title: 'b', source: 's', url: 'u1' },
  { tier: 'community', date: iso(2), title: 'a', source: 's', url: 'u2' },
]);
const twiceAgain = buildRows([
  { tier: 'community', date: iso(2), title: 'a', source: 's', url: 'u2' },
  { tier: 'community', date: iso(2), title: 'b', source: 's', url: 'u1' },
]);
ok(
  JSON.stringify(twice.community) === JSON.stringify(twiceAgain.community),
  'same input order-independently produces identical rows (no churn)'
);

// --- dedupe ---------------------------------------------------------------
const dupes = buildRows([
  { tier: 'secondary', date: iso(1), title: 'DeepSeek ships thing', source: 'A', url: 'u1', detail: 'first' },
  { tier: 'secondary', date: iso(1), title: 'DeepSeek ships thing', source: 'B', url: 'u2', detail: '' },
]);
ok(dupes.secondary.length === 1, `syndicated duplicate collapses (got ${dupes.secondary.length})`);
ok(dupes.secondary[0].detail === 'first', 'duplicate keeps the richer detail');

// --- tier isolation -------------------------------------------------------
const mixed = buildRows([
  { tier: 'official', date: iso(1), title: 'official item', source: 's', url: 'u1' },
  { tier: 'secondary', date: iso(1), title: 'media item', source: 's', url: 'u2' },
]);
ok(mixed.official === undefined, 'official tier is excluded entirely');
ok(mixed.secondary.length === 1, 'secondary tier is kept');

// --- staleness ------------------------------------------------------------
const stale = buildRows([
  { tier: 'rumor', date: iso(45), title: 'ancient leak', source: 's', url: 'u1' },
  { tier: 'rumor', date: iso(2), title: 'fresh leak', source: 's', url: 'u2' },
  { tier: 'rumor', date: null, title: 'undated', source: 's', url: 'u3' },
]);
ok(stale.rumor.length === 1 && stale.rumor[0].title === 'fresh leak',
  `rumour window drops stale + undated (got ${stale.rumor.map(r => r.title).join(',')})`);

// --- markdown injection safety -------------------------------------------
const nasty = buildRows([
  { tier: 'community', date: iso(1), title: 'a | b\nsecond row', source: 's', url: 'u1' },
]);
ok(nasty.community[0].title === 'a \\| b second row', 'pipes and newlines cannot break the table');

// --- per-tier caps --------------------------------------------------------
const many = buildRows(
  Array.from({ length: 60 }, (_, i) => ({
    tier: 'secondary', date: iso(1), title: `item ${String(i).padStart(3, '0')}`, source: 's', url: `u${i}`,
  }))
);
ok(many.secondary.length === 25, `secondary capped at 25 (got ${many.secondary.length})`);

console.log(fail ? `\n${fail} failure(s)` : '\nsignals row-building OK');
process.exit(fail ? 1 : 0);