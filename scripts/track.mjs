import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const STATE_FILE = path.join(ROOT, 'data', 'state.json');
const FILES = {
  news: path.join(ROOT, 'NEWS.md'),
  changelog: path.join(ROOT, 'api-changelog.md'),
  releases: path.join(ROOT, 'releases.md'),
  npm: path.join(ROOT, 'npm.md'),
};

const API_DOCS = 'https://api-docs.deepseek.com';
const CHANGELOG_URL = `${API_DOCS}/updates`;
const NEWS_BASE = `${API_DOCS}/news/`;
const NPM_PACKAGE = '@deepseek-ai/dsh';

const OFFICIAL_REPOS = [
  'deepseek-ai/deepseek-harness',
  'deepseek-ai/DeepSeek-V3',
  'deepseek-ai/DeepSeek-R1',
  'deepseek-ai/DeepSeek-OCR',
  'deepseek-ai/DeepSeek-OCR-2',
  'deepseek-ai/FlashMLA',
  'deepseek-ai/DeepEP',
  'deepseek-ai/DeepGEMM',
  'deepseek-ai/3FS',
  'deepseek-ai/smallpond',
  'deepseek-ai/DeepSpec',
  'deepseek-ai/TileKernels',
  'deepseek-ai/Engram',
  'deepseek-ai/DualPipe',
  'deepseek-ai/Janus',
  'deepseek-ai/DeepSeek-VL2',
  'deepseek-ai/DeepSeek-Coder-V2',
  'deepseek-ai/DeepSeek-Math-V2',
  'deepseek-ai/DeepSeek-Prover-V2',
  'deepseek-ai/DeepSeek-V3.2-Exp',
  'deepseek-ai/EPLB',
  'deepseek-ai/ESFT',
  'deepseek-ai/LPLB',
  'deepseek-ai/awesome-deepseek-integration',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, opts = {}) {
  const headers = { 'User-Agent': 'deepseek-official-tracker (github action)', ...(opts.headers || {}) };
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .trim();
}

// --- Source 1: API Change Log (https://api-docs.deepseek.com/updates) ---
function parseChangelog(html) {
  const entries = [];
  const h2Re = /<h2[^>]*>\s*Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*>\s*Date:|$)/gi;
  let m;
  while ((m = h2Re.exec(html)) !== null) {
    const date = m[1];
    const body = m[2];
    const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;
    let t;
    while ((t = h3Re.exec(body)) !== null) {
      const title = stripHtml(t[1]).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s*[?#]\s*$/, '');
      const summary = stripHtml(t[2]).slice(0, 600);
      entries.push({ date, title, summary });
    }
  }
  return entries;
}

// --- Source 2: Official News pages (slugs discovered from changelog) ---
function extractNewsSlugs(html) {
  const slugs = new Set();
  const re = /href="\/news\/(news[0-9]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1]);
  return [...slugs];
}

async function fetchNewsTitles(slugs) {
  const items = [];
  for (const slug of slugs.slice(0, 10)) {
    try {
      const html = await fetchText(`${NEWS_BASE}${slug}`);
      const og = (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || [])[1] || '';
      const title = decodeEntities(og.replace(/\s*\|\s*DeepSeek API Docs\s*$/i, '') || slug);
      const d = slug.replace(/^news/, '');
      const date = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
      items.push({ slug, url: `${NEWS_BASE}${slug}`, title, date });
    } catch (e) {
      console.warn(`news ${slug}: ${e.message}`);
    }
    await sleep(300);
  }
  return items;
}

// --- Source 3: GitHub releases & tags ---
async function fetchReleases(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const items = [];
  for (const repo of OFFICIAL_REPOS) {
    try {
      const [rel, tags] = await Promise.all([
        fetchText(`https://api.github.com/repos/${repo}/releases?per_page=5`, { headers }).then(JSON.parse),
        fetchText(`https://api.github.com/repos/${repo}/tags?per_page=5`, { headers }).then(JSON.parse),
      ]);
      for (const r of rel) {
        items.push({ kind: 'release', repo, tag: r.tag_name, name: r.name || r.tag_name, published_at: r.published_at, url: r.html_url });
      }
      for (const t of tags) {
        items.push({ kind: 'tag', repo, tag: t.name, name: t.name, published_at: '', url: `https://github.com/${repo}/releases/tag/${t.name}` });
      }
    } catch (e) {
      console.warn(`releases ${repo}: ${e.message}`);
    }
    await sleep(200);
  }
  return items;
}

// --- Source 4: npm package ---
async function fetchNpm() {
  const data = JSON.parse(await fetchText(`https://registry.npmjs.org/${NPM_PACKAGE}`));
  const versions = Object.keys(data.versions || {});
  return {
    latest: data['dist-tags']?.latest || '',
    versions,
    time: data.time || {},
  };
}

// --- helpers ---
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { changelog: [], news: [], releases: [], npm: [] };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function appendEntries(file, header, entries, render) {
  let existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const newLines = [];
  for (const e of entries) {
    const line = render(e);
    if (!existing.includes(line)) newLines.push(line);
  }
  if (newLines.length === 0) return;
  const rest = existing
    .replace(header, '')
    .replace(/^\s*\n/, '')
    .replace(/_No entries yet\._\s*\n?/g, '')
    .trim();
  fs.writeFileSync(file, header + '\n\n' + newLines.join('\n\n') + (rest ? '\n\n---\n\n' + rest + '\n' : '\n'));
}

function renderMarkdownEntry(e) {
  const lines = [`## [${e.date}] ${e.title}`];
  if (e.summary) lines.push(e.summary);
  if (e.url) lines.push(`[Source](${e.url})`);
  lines.push('---');
  return lines.join('\n\n');
}

// --- main ---
async function main() {
  const token = process.env.GITHUB_TOKEN || '';
  const state = loadState();
  const now = new Date().toISOString();
  const summary = { changelog: 0, news: 0, releases: 0, npm: 0 };

  // 1. API changelog
  try {
    const changelogHtml = await fetchText(CHANGELOG_URL);
    const entries = parseChangelog(changelogHtml);
    const seen = new Set(state.changelog);
    const fresh = entries.filter((e) => !seen.has(`${e.date}|${e.title}`));
    state.changelog.push(...fresh.map((e) => `${e.date}|${e.title}`));
    state.changelog = state.changelog.slice(-500);
    appendEntries(FILES.changelog, '# DeepSeek API Change Log (mirror)', fresh, (e) =>
      renderMarkdownEntry({ ...e, url: `${CHANGELOG_URL}#date-${e.date}` })
    );
    summary.changelog = fresh.length;

    // 2. News pages (slugs discovered from changelog)
    const slugs = extractNewsSlugs(changelogHtml);
    const newsItems = await fetchNewsTitles(slugs);
    const seenNews = new Set(state.news);
    const freshNews = newsItems.filter((n) => !seenNews.has(n.slug));
    state.news.push(...freshNews.map((n) => n.slug));
    state.news = state.news.slice(-200);
    appendEntries(FILES.news, '# DeepSeek Official News', freshNews, (e) =>
      renderMarkdownEntry({ ...e, url: e.url })
    );
    summary.news = freshNews.length;
  } catch (e) {
    console.warn(`changelog: ${e.message}`);
  }

  // 3. GitHub releases & tags
  try {
    const releases = await fetchReleases(token);
    const seenRel = new Set(state.releases);
    const freshRel = releases.filter((r) => !seenRel.has(`${r.repo}|${r.tag}`));
    state.releases.push(...freshRel.map((r) => `${r.repo}|${r.tag}`));
    state.releases = state.releases.slice(-1000);
    appendEntries(FILES.releases, '# DeepSeek Official GitHub Releases & Tags', freshRel, (e) =>
      renderMarkdownEntry({ date: (e.published_at || '').slice(0, 10) || 'n/a', title: `${e.repo} ${e.kind} ${e.tag}`, summary: e.name, url: e.url })
    );
    summary.releases = freshRel.length;
  } catch (e) {
    console.warn(`releases: ${e.message}`);
  }

  // 4. npm package
  try {
    const npm = await fetchNpm();
    const seenVersions = new Set(state.npm);
    const freshVersions = npm.versions.filter((v) => !seenVersions.has(v));
    state.npm.push(...freshVersions);
    state.npm = state.npm.slice(-100);
    appendEntries(FILES.npm, `# npm: ${NPM_PACKAGE}`, freshVersions, (v) =>
      renderMarkdownEntry({ date: (npm.time[v] || '').slice(0, 10) || 'n/a', title: `v${v}`, summary: v === npm.latest ? 'latest' : '', url: `https://www.npmjs.com/package/${NPM_PACKAGE}/v/${v}` })
    );
    summary.npm = freshVersions.length;
  } catch (e) {
    console.warn(`npm: ${e.message}`);
  }

  saveState(state);

  // Combined feed
  const sections = [FILES.changelog, FILES.news, FILES.releases, FILES.npm].map((f) =>
    fs.readFileSync(f, 'utf8')
  );
  const allEntries = sections
    .flatMap((s) => [...s.matchAll(/^## \[([^\]]+)\] (.*)$/gm)].map((m) => ({ date: m[1], title: m[2] })))
    .sort((a, b) => (a.date === 'n/a' ? 1 : b.date === 'n/a' ? -1 : a.date < b.date ? 1 : -1))
    .slice(0, 60);
  const feed = `# DeepSeek Official Tracker Feed\n\n> Auto-generated by GitHub Actions.\n\n` +
    allEntries.map((e) => `- **${e.date}** ${e.title}`).join('\n') + '\n';
  fs.writeFileSync(path.join(ROOT, 'FEED.md'), feed);

  console.log(JSON.stringify({ now, ...summary }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});