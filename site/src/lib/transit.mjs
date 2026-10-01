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
function releaseKeys(title, date = '') {
  const t = title.trim();
  const d = (date || '').trim();
  // The date is part of the identity. Nine different API changelog entries are
  // all titled `deepseek-chat`; keyed on the title alone they collapsed into a
  // single step that printed five "02 API" badges, which reads as a rendering
  // bug because it is one.
  const keys = new Set([`t:${d}:${t.toLowerCase()}`]);

  // deepseek-ai/deepseek-harness release dsh-v0.2.0-rc.2
  //   -> tag:deepseek-harness:v0.2.0-rc.2  and  ver:deepseek-harness:v0.2.0-rc.2
  // The leading v is kept: the npm line spells the same v0.2.0-rc.2, and
  // normalising it away is what stops the two lines from bridging. The repo is
  // kept for the opposite reason — DeepSeek-V3 and DeepSeek-R1 both shipped
  // v1.0.0, and an unscoped version key welded two unrelated model launches into
  // one step.
  const gh = t.match(/^deepseek-ai\/([\w.-]+) (?:release|tag)\s+(\S+)$/);
  if (gh) {
    const repo = gh[1].toLowerCase();
    const ver = gh[2].replace(/^dsh-/, '').toLowerCase();
    keys.add(`tag:${repo}:${ver}`);
    keys.add(`ver:${repo}:${ver}`);
  }

  // Bare npm version lines: v0.2.0-rc.2. npm carries exactly one DeepSeek
  // package, so the harness is the only repository a bare version can belong to.
  const bareVer = t.match(/^(?:dsh-)?(v\d[\w.+-]*)$/);
  if (bareVer) keys.add(`ver:deepseek-harness:${bareVer[1].toLowerCase()}`);

  // Model weights and model launch titles, one pattern for both spellings:
  //   deepseek-ai/DeepSeek-V4.1-Flash       -> v4.1-flash
  //   Introducing DeepSeek-V4.1-Flash: ...  -> v4.1-flash
  //   DeepSeek-V4-Flash-Vision-Exp Release  -> v4-flash-vision-exp
  //   DeepSeek-V4-Pro-0813                  -> v4-pro-0813
  // Suffix groups accept digits, not only letters: DeepSeek-V4-Pro-0813 and
  // DeepSeek-V4-Pro are two separate weight drops, and merging them printed the
  // HF badge twice on a single step. Lowercasing after capture is what makes the
  // blog title and the HuggingFace model id land on the same key.
  const model = t.match(/deepseek-(v?[\d.]+(?:-[a-z0-9]+)+)/i);
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
 * Cut to a length without leaving half a word behind.
 *
 * A hard slice at 220 characters is how the DeepSeek-V3.2 and deepseek-chat
 * summaries ended mid-token; the ellipsis makes the cut legible as a cut rather
 * than as the end of the official text.
 */
function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.—-]+$/, '')}…`;
}

/**
 * True when the body line is machine metadata rather than something a reader
 * should read.
 *
 * Two sources emit a body that is not prose. huggingface.md writes the model
 * card's own metadata row — "❤️ 765 · 📥 90,822 · text-generation · transformers,
 * safetensors, deepseek_v4, text-generation, conversational" — and npm.md writes
 * the dist-tag it was published under, which is the single word "latest". Both
 * landed in the page verbatim as the step's summary, so a model launch read as
 * "❤️ 3,748 · 📥 3,959,575 · text-generation · …". That is the one place on the
 * page where scraper output is shown as if a human had written it, and the page
 * claims the opposite everywhere else.
 *
 * Detection is by shape, not by source, so a future seventh source is judged the
 * same way: a metadata row is a list of short tokens joined by the same
 * separator, and a dist-tag is a single lowercase word with no sentence in it.
 */
function isMetadata(summary) {
  const s = summary.trim();
  if (!s) return true;

  // npm dist-tags: latest, next, beta, canary, alpha.
  if (/^[a-z][a-z\d.-]{0,14}$/.test(s)) return true;

  // HF model-card rows. They always open with a like count and a heart, or a
  // download count and the inbox tray; the separator is U+00B7 with the emoji
  // that PowerShell rendered as "??" on a non-UTF8 console.
  if (/^[\u2764\u2665\u2763\uD83D\uDCE5]/u.test(s) && /[\u00b7|,]/.test(s)) return true;
  // The same row with the leading emoji stripped by an earlier normaliser.
  if (/^\d[\d,]*\s*[\u00b7|,]\s*\d/.test(s) && /safetensors|text-generation|tokenizers|transformers|arxiv:|region:/.test(s)) return true;
  // A bare tag list with no numbers and no prose: "safetensors, qwen3, region:us".
  if (/^[a-z][a-z\d_:+.-]*(?:\s*[\u00b7|,]\s*[a-z][a-z\d_:+.-]*)+$/.test(s)
      && /safetensors|tokenizers|transformers|text-generation|region:|arxiv:/.test(s)) return true;

  return false;
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
    const clean = summary.replace(/\[([^\]]*)\]\([^)]*\)/g, '').trim();
    out.push({
      line: lineId,
      date,
      title,
      url: src,
      summary: isEcho(summary, title) || isMetadata(clean) ? '' : clip(clean, 220),
      keys: [...releaseKeys(title, date)],
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
        //
        // One badge per line, not one per entry: the badge *is* the line
        // identifier, so two entries on the same line printed "02 API" twice and
        // read as a duplicate. When a line contributed several entries the extra
        // ones are folded into the badge's tooltip instead of dropped, so
        // nothing becomes unreachable — the link is the product.
        sources: (() => {
          const byLine = new Map();
          for (const m of members) {
            if (!m.url) continue;
            const cur = byLine.get(m.line);
            if (!cur) byLine.set(m.line, { line: m.line, title: m.title, url: m.url, also: [] });
            else cur.also.push(m.title);
          }
          return [...byLine.values()];
        })(),
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