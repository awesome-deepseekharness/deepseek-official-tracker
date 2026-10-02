/**
 * transit.mjs — turn the tracker's flat markdown feed into a transit diagram.
 *
 * The product is already a transit map and does not know it: six independent
 * official sources are six lines, and a release that shows up on more than one
 * of them is an interchange — the place where those lines meet. That structure
 * is what this module recovers from the per-source markdown files, so the page
 * can show provenance spatially instead of as a reverse-chronological list where
 * a model launch and an npm patch bump look equally important.
 *
 * Pure functions only; the page reads files at the edge.
 */

import fs from 'node:fs';
import path from 'node:path';

// The six tracked official sources, ordered as a system: the blog is the trunk
// line (DeepSeek's own voice), the API changelog the second trunk, and the
// distribution channels branch off them.
export const LINES = [
  {
    id: 'blog',
    label: 'deepseek.com blog',
    short: 'Blog',
    color: 'var(--line-blog)',
    endpoint: 'https://www.deepseek.com/en/news/',
    file: 'website-news.md',
  },
  {
    id: 'api',
    label: 'API changelog',
    short: 'API',
    color: 'var(--line-api)',
    endpoint: 'https://api-docs.deepseek.com/updates',
    file: 'api-changelog.md',
  },
  {
    id: 'github',
    label: 'GitHub releases',
    short: 'GitHub',
    color: 'var(--line-github)',
    endpoint: 'https://github.com/deepseek-ai',
    file: 'releases.md',
  },
  {
    id: 'hf',
    label: 'HuggingFace models',
    short: 'HF',
    color: 'var(--line-hf)',
    endpoint: 'https://huggingface.co/deepseek-ai',
    file: 'huggingface.md',
  },
  {
    id: 'npm',
    label: 'npm @deepseek-ai',
    short: 'npm',
    color: 'var(--line-npm)',
    endpoint: 'https://www.npmjs.com/package/@deepseek-ai/dsh',
    file: 'npm.md',
  },
  {
    id: 'news',
    label: 'API news pages',
    short: 'News',
    color: 'var(--line-news)',
    endpoint: 'https://api-docs.deepseek.com/news',
    file: 'NEWS.md',
  },
];

/**
 * A release's identity, for matching across lines.
 *
 * Two cases carry the interchanges. First the harness/npm pair: every GitHub
 * release produces a same-day npm publish of the identical version string, and
 * those are one event on two lines. Second model names: a weight drop appears
 * on HuggingFace as `deepseek-ai/DeepSeek-V4.1-Flash` and on the blog as
 * "Introducing DeepSeek-V4.1-Flash: ...", with no shared substring worth
 * trusting.
 */
function releaseKeys(title) {
  const t = title.trim();
  const keys = new Set([`t:${t.toLowerCase()}`]);

  // deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2  ->  v0.2.0-rc.2
  // The leading v is kept: the npm line spells the same version v0.2.0-rc.2, and
  // normalising it away here is what stops the two lines from bridging.
  const gh = t.match(/^deepseek-ai\/[\w.-]+ release\s+(\S+)$/);
  if (gh) {
    keys.add(`tag:${gh[1].toLowerCase()}`);
    keys.add(`ver:${gh[1].replace(/^dsh-/, '').toLowerCase()}`);
  }

  // Bare npm version lines: v0.2.0-rc.2
  const bareVer = t.match(/^(?:dsh-)?(v\d[\w.+-]*)$/);
  if (bareVer) keys.add(`ver:${bareVer[1].toLowerCase()}`);

  // Model weights and model launch titles, one pattern for both spellings:
  //   deepseek-ai/DeepSeek-V4.1-Flash       -> v4.1-flash
  //   Introducing DeepSeek-V4.1-Flash: ...  -> v4.1-flash
  //   DeepSeek-V4-Flash-Vision-Exp Release  -> v4-flash-vision-exp
  // Lowercasing after capture is what makes the blog title and the HuggingFace
  // model id land on the same key.
  const model = t.match(/deepseek-(v?[\d.]+(?:-[a-z]+)+)/i);
  if (model) keys.add(`model:${model[1].toLowerCase()}`);

  return keys;
}

/**
 * A reader-facing label for an official title.
 *
 * The tracker's promise is that official titles are copied verbatim, and the
 * verbatim string stays on the entry and in each link's tooltip. This is a
 * deterministic trim of that same string — no model, no rewording: it drops the
 * "deepseek-ai/" owner prefix and the redundant "release" word that
 * track.mjs emits, so a station reads "DeepSeek Harness v0.2.0-rc.2" instead of
 * "deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2".
 */
export function prettyTitle(title) {
  const t = title.trim();
  const gh = t.match(/^deepseek-ai\/(\S+?)\s+release\s+(\S+)$/);
  if (gh) {
    const repo = gh[1]
      .replace(/^deepseek-harness$/i, 'DeepSeek Harness')
      .replace(/[-_](\w)/g, (_, c) => ` ${c.toUpperCase()}`);
    const tag = gh[2].replace(/^dsh-/, '');
    return `${repo} ${tag}`;
  }
  // Bare version lines belong to npm; name them so a stop is not just "v0.2.0".
  if (/^(?:dsh-)?v\d[\w.+-]*$/.test(t)) return `DeepSeek CLI ${t.replace(/^dsh-/, '')}`;
  // Owner-prefixed model repos: deepseek-ai/DeepSeek-V4.1-Flash
  const model = t.match(/^deepseek-ai\/(DeepSeek-\S+)$/);
  if (model) return model[1];
  return t;
}

/** True when a body line just repeats the version already in the title. */
function isEcho(summary, title) {
  if (!summary) return true;
  const s = summary.trim().toLowerCase();
  if (s.length < 3) return true;
  const t = title.toLowerCase();
  if (s === t) return true;
  // "v0.2.0-rc.2" against "… release dsh-v0.2.0-rc.2"
  const bare = s.replace(/^v/, '');
  return bare.length > 3 && t.replace(/^v/, '').includes(bare);
}

/**
 * Parse one per-source markdown file into stations.
 * Shape written by track.mjs: `## [date] title`, optional summary,
 * `[Source](url)`, `---`.
 */
export function parseSourceFile(md, lineId) {
  const out = [];
  if (!md) return out;
  // Normalise CRLF first: `$` in a /m regex sits before \n but after \r, so a
  // Windows checkout never matches /^---$/ and every file parses as empty.
  const text = md.replace(/\r\n/g, '\n');
  for (const block of text.split(/^---$/m)) {
    const head = block.match(/^##\s*\[([^\]]+)\]\s*(.+)$/m);
    if (!head) continue;
    const date = head[1].trim();
    const title = head[2].trim();
    const src = (block.match(/\[Source\]\(([^)]+)\)/) || [])[1] || null;
    // First non-empty line after the heading that is not a Source link.
    const summary = (block
      .split('\n')
      .slice(1)
      .map(l => l.trim())
      .find(l => l && !l.startsWith('[Source]') && !l.startsWith('#'))) || '';
    out.push({
      line: lineId,
      date,
      title,
      url: src,
      summary: isEcho(summary, title) ? '' : summary.replace(/\[([^\]]*)\]\([^)]*\)/g, '').trim().slice(0, 220),
      keys: [...releaseKeys(title)],
    });
  }
  return out;
}

/**
 * Merge every line's stations into the diagram model.
 *
 * Stations are clustered by shared release keys; a cluster reached by 2+ lines
 * is an interchange, a cluster on one line stays a plain stop. Union-find does
 * the grouping so transitive sharing collapses too: a launch on the blog can
 * reach its weight drop on HuggingFace through a changelog entry rather than
 * needing a direct title match.
 */
export function buildNetwork(perLineStations) {
  // Accepts a flat array or one array per line, so callers need not care.
  const stations = perLineStations.flat().filter(s => s && s.keys);

  const parent = stations.map((_, i) => i);
  const find = i => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) { const n = parent[i]; parent[i] = r; i = n; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const firstForKey = new Map();
  stations.forEach((s, i) => {
    for (const key of s.keys) {
      const seen = firstForKey.get(key);
      if (seen === undefined) firstForKey.set(key, i);
      else union(seen, i);
    }
  });

  const groups = new Map();
  stations.forEach((s, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(s);
  });

  return [...groups.values()]
    .map(members => {
      const lines = [...new Set(members.map(m => m.line))];
      const dated = members.map(m => m.date).filter(d => d !== 'n/a').sort();
      const date = dated.pop() || members[0].date;
      // The most descriptive member is the one whose title is not a bare version
      // string; that becomes the interchange's station name.
      const nameMember = members.find(m => m.title.length > 24) || members[0];
      // Prefer a first-party trunk line for the primary link: the blog post is
      // the canonical record, an npm page is the least explanatory.
      const url =
        members.find(m => m.line === 'blog' && m.url)?.url
        || members.find(m => m.line === 'api' && m.url)?.url
        || members.find(m => m.url)?.url
        || null;
      return {
        id: `${date}:${members[0].title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`,
        name: prettyTitle(nameMember.title),
        // The untouched official title, kept for the link tooltips.
        verbatim: nameMember.title,
        date,
        lines,
        interchange: lines.length > 1,
        url,
        summary: nameMember.summary || '',
        // Every source link, so verification never costs more than one click.
        sources: members.filter(m => m.url).map(m => ({ line: m.line, title: m.title, url: m.url })),
      };
    })
    .sort((a, b) => {
      // Undated GitHub tags carry no timestamp. Sorting them lexicographically
      // puts "n/a" first and buries every dated release under a wall of tags,
      // which is the opposite of what a newest-first scan needs.
      const aU = a.date === 'n/a';
      const bU = b.date === 'n/a';
      if (aU !== bU) return aU ? 1 : -1;
      if (aU) return a.name.localeCompare(b.name);
      return a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name);
    });
}

/** Per-line station counts, for the route legend. */
export function lineTotals(stops) {
  const totals = {};
  for (const l of LINES) totals[l.id] = 0;
  for (const s of stops) for (const id of s.lines) totals[id] = (totals[id] || 0) + 1;
  return totals;
}

/**
 * Apparent magnitude for a release, from how many independent sources carry it.
 *
 * An almanac reader judges an object by magnitude: lower number, brighter, more
 * notable. That is exactly the judgement this product's data supports and a
 * reverse-chronological feed cannot express — a release corroborated by three
 * independent first-party surfaces is a genuinely different event from one that
 * appeared on a single npm registry, and on the old page the two rows were
 * typographically identical.
 *
 * The scale is the real astronomical one, not a 1-3 badge dressed up as one:
 * magnitude is logarithmic and inverted, so brighter means smaller. Mapping
 * corroboration count onto that curve means the gap between 1 source and 2
 * sources is large (both real and unremarkable) and the gap between 4 and 5 is
 * small (both exceptional), which is the truth about this data.
 *
 * Undated GitHub tags get no magnitude: they carry no position on the table, so
 * assigning them a brightness would assert something the data does not support.
 */
const MAGNITUDE_STEPS = [
  { sources: 1, mag: 5.4 },
  { sources: 2, mag: 4.3 },
  { sources: 3, mag: 3.1 },
  { sources: 4, mag: 2.2 },
  { sources: 5, mag: 1.5 },
  { sources: 6, mag: 0.9 },
];

export function magnitudeOf(stop) {
  if (!stop || stop.date === 'n/a') return null;
  const n = new Set(stop.lines || []).size;
  const step = MAGNITUDE_STEPS.find(s => n <= s.sources) || MAGNITUDE_STEPS[MAGNITUDE_STEPS.length - 1];
  // One decimal is what a printed almanac prints; a second place would imply a
  // precision the underlying count cannot support.
  return { value: step.mag, sources: n };
}

/**
 * Weekly release density, for the transit strip.
 *
 * The tracker rebuilt every six hours for weeks while its headline sat on a
 * single September release, and the honest reaction was "this thing is dead."
 * A band of marks shows the opposite fact — shipping is continuous and the page
 * is keeping up — without asking anyone to trust a timestamp or read a log.
 *
 * Weeks are bucketed newest-last so the strip reads left-to-right in time like
 * a printed almanac's year spread, and empty weeks are emitted rather than
 * skipped: a gap in the band is itself information, and collapsing it would
 * hide exactly the quiet period a reader needs to see.
 */
export function weeklyCadence(stops, { weeks = 16 } = {}) {
  const dated = stops.filter(s => s.date && s.date !== 'n/a');
  if (!dated.length) return [];

  const dayMs = 86400000;
  const latest = Math.max(...dated.map(s => Date.parse(`${s.date}T00:00:00Z`)));

  // Both the bucket keys and the per-stop lookup have to be anchored to the same
  // weekday or nothing ever matches. Anchoring only the lookup is the bug this
  // comment replaced: buckets were keyed off the newest release's weekday while
  // stops were looked up by Monday, so every column came back empty and the
  // caption read "0 releases in 16 weeks" — a confidently wrong number on the
  // one element whose entire job is to prove the tracker is alive.
  const mondayOf = t => t - ((new Date(t).getUTCDay() + 6) % 7) * dayMs;
  const thisMonday = mondayOf(latest);
  const start = thisMonday - (weeks - 1) * 7 * dayMs;
  const end = thisMonday + 7 * dayMs; // exclusive

  const buckets = new Map();
  for (let t = start; t < end; t += 7 * dayMs) {
    buckets.set(t, { weekStart: t, stops: [] });
  }
  for (const s of dated) {
    const b = buckets.get(mondayOf(Date.parse(`${s.date}T00:00:00Z`)));
    if (b) b.stops.push(s);
  }

  return [...buckets.values()]
    .sort((a, b) => a.weekStart - b.weekStart)
    .map(b => {
      const strongest = b.stops.reduce(
        (acc, s) => {
          const n = new Set(s.lines).size;
          return n > acc.count ? { count: n, stop: s } : acc;
        },
        { count: 0, stop: null }
      );
      return {
        weekStart: new Date(b.weekStart).toISOString().slice(0, 10),
        count: b.stops.length,
        strongest: strongest.stop,
        strongestSources: strongest.count,
      };
    });
}

/**
 * Parse insights.md's signal sections into the unverified strip.
 * Only Secondary and Community qualify — the verified findings are already on
 * the diagram and must not be repeated as if they were rumours.
 */
export function parseSignals(insights) {
  const out = [];
  if (!insights) return out;
  // Same CRLF reason as parseSourceFile: on a Windows checkout every line after
  // the first ends in \r, which defeats ^\s*[-*] on the bullet match.
  const text = insights.replace(/\r\n/g, '\n');
  // Slice on every level-2 heading, not just the signal ones: bounding only
  // between signal headings would let the last one run to EOF and swallow
  // Trends/Cross-check/Risk as if they were signals.
  const allH2 = [...text.matchAll(/^##\s+(.+?)\s*$/gm)];
  for (const [i, h] of allH2.entries()) {
    const name = h[1].trim();
    const tier = /^secondary signals/i.test(name)
      ? 'secondary'
      : /^community signals/i.test(name)
        ? 'community'
        : null;
    if (!tier) continue;
    const start = h.index + h[0].length;
    const end = i + 1 < allH2.length ? allH2[i + 1].index : text.length;
    for (const line of text.slice(start, end).split('\n')) {
      // Entries look like: - **Headline** (date) — detail. [Source](url)
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (!bullet) continue;
      const raw = bullet[1];
      const links = [...raw.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g)];
      if (!links.length) continue;

      // The bold span is the headline the research pass already wrote; the rest
      // is its supporting detail. Preferring it keeps rows to one scannable
      // line instead of truncating a 190-char summary mid-word.
      const bold = (raw.match(/\*\*([^*]+)\*\*/) || [])[1];
      const body = raw
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\((?:secondary|community|unverified)[^)]*\)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let title;
      if (bold) {
        title = bold.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim();
      } else {
        // No bold: stop at the first clause boundary rather than mid-word.
        const cut = body.split(/ — | \. /)[0];
        title = cut.length < body.length ? `${cut}…` : cut;
      }
      if (title.length > 150) title = `${title.slice(0, 147).replace(/[\s·—-]+$/, '')}…`;
      if (!title) continue;

      out.push({
        tier,
        section: name,
        title,
        date: (raw.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null,
        url: links[links.length - 1][2],
      });
    }
  }
  return out;
}

/**
 * Parse SIGNALS.md's deterministic tier tables.
 *
 * insights.md is the AI narrative and is gated behind a PR, so it froze for
 * three weeks while releases kept shipping — the page's "Early signals" strip
 * emptied out with it. SIGNALS.md is generated from the same key-free corners
 * with no model in the loop and commits every 6h, so it is the strip's primary
 * source; insights.md still contributes its Secondary/Community sections when
 * they exist.
 *
 * Rows look like:
 *   | 🆕 | 2026-09-29 | 量子位 | [headline](url) — detail |
 */
export function parseSignalTables(signalsMd) {
  const out = [];
  if (!signalsMd) return out;
  const text = signalsMd.replace(/\r\n/g, '\n');
  // Bound each section at the next level-3 heading so the trailing "How to read
  // this" table is not mistaken for signal rows.
  for (const section of text.split(/^###\s+/m).slice(1)) {
    const heading = (section.match(/^([^\n]+)/) || [])[1] || '';
    const tier = /rumou?r/i.test(heading) ? 'rumor'
      : /^community/i.test(heading) ? 'community'
        : /^secondary/i.test(heading) ? 'secondary'
          : null;
    if (!tier) continue;

    for (const line of section.split('\n')) {
      // The optional 🆕 column sits between two pipes, so a data row reads
      // "| 🆕 | 2026-09-22 | Source | …". The leading-cell group must tolerate
      // the space after that closing pipe — matching `\d{4}` straight off the
      // pipe silently skipped every 🆕 row, which is most of them on a busy day.
      const row = line.match(/^\|\s*(?:(?:🆕)?\s*\|)?\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]*?)\s*\|/);
      if (!row) continue;
      const date = row[1];
      const source = row[2] || '';
      const link = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (!link) continue;
      const detail = line.split('—').slice(1).join('—').trim();
      out.push({
        tier,
        section: heading.replace(/\s*·.*$/, '').trim(),
        title: link[1],
        date,
        source,
        isNew: /🆕/.test(line),
        url: link[2],
        detail: detail.slice(0, 160),
      });
    }
  }
  return out;
}

/** Read the FEED.md build timestamp out of its header blockquote. */
export function parseFeedStamp(feed) {
  return (feed.match(/last update:\s*([0-9T:.Z-]+)/) || [])[1] || null;
}

/**
 * Locate the staged data directory.
 *
 * Not derived from import.meta.url: Vite rewrites that during an Astro build,
 * so a path built from it resolves outside the project and every read silently
 * returns ''. That produced an empty diagram with zeroed counts rather than an
 * error, which is the worst possible failure mode. Anchor on the working
 * directory astro was launched from and walk up until the staged files appear.
 */
export function resolveDataDir(start = process.cwd()) {
  const names = ['FEED.md', 'releases.md', 'npm.md'];
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i++) {
    if (names.some(n => fs.existsSync(path.join(dir, 'public', n)))) {
      return path.join(dir, 'public');
    }
    if (names.some(n => fs.existsSync(path.join(dir, n)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start, 'public');
}

export { releaseKeys };