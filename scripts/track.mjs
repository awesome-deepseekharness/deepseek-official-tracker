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
  websiteNews: path.join(ROOT, 'website-news.md'),
  huggingface: path.join(ROOT, 'huggingface.md'),
};

const API_DOCS = 'https://api-docs.deepseek.com';
const CHANGELOG_URL = `${API_DOCS}/updates`;
const NEWS_BASE = `${API_DOCS}/news/`;
const NPM_PACKAGE = '@deepseek-ai/dsh';
const WEBSITE_NEWS_URL = 'https://www.deepseek.com/en/news/';
const HF_API = 'https://huggingface.co/api/models?author=deepseek-ai&sort=lastModified&direction=-1&limit=20';

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
  const headers = { 'User-Agent': 'deepseek-official-tracker/1.1 (github action; +https://github.com/awesome-deepseekharness/deepseek-official-tracker)', ...(opts.headers || {}) };
  const timeoutMs = opts.timeoutMs || 15000;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, redirect: 'follow', signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < 3) {
        const backoff = attempt * 800;
        console.warn(`fetch retry ${attempt}/3 ${url}: ${e.message} -> ${backoff}ms`);
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
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

function isValidDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  if (day < 1 || day > 31) return false;
  if (y < 2023 || y > 2030) return false;
  return true;
}

// --- Source 1: API Change Log (https://api-docs.deepseek.com/updates) ---
function parseChangelog(html) {
  const entries = [];
  const h2Re = /<h2[^>]*>\s*Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*>\s*Date:|$)/gi;
  let m;
  while ((m = h2Re.exec(html)) !== null) {
    const date = m[1];
    if (!isValidDate(date)) continue;
    const body = m[2];
    const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;
    let t;
    while ((t = h3Re.exec(body)) !== null) {
      const title = stripHtml(t[1]).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s*[?#]\s*$/, '');
      if (!title) continue;
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

function parseNewsDateFromSlug(slug, html) {
  // Try to extract published_time from html first (most reliable)
  const pubMatch = html.match(/property="article:published_time"[^>]*content="([^"]+)"/i)
    || html.match(/name="pubdate"[^>]*content="([^"]+)"/i)
    || html.match(/<time[^>]*datetime="([^"]+)"/i);
  if (pubMatch) {
    const d = pubMatch[1].slice(0, 10);
    if (isValidDate(d)) return d;
  }
  // Fallback to slug decoding: newsYYMMDD or newsMMDD
  const d = slug.replace(/^news/, '');
  if (d.length >= 6) {
    // YYMMDD -> 20YY-MM-DD (e.g., 260813 -> 2026-08-13)
    const yy = d.slice(0, 2), mm = d.slice(2, 4), dd = d.slice(4, 6);
    const candidate = `20${yy}-${mm}-${dd}`;
    if (isValidDate(candidate)) return candidate;
  }
  if (d.length === 4) {
    // MMDD without year – cannot reliably infer year, return n/a to avoid 2012-26- style bug
    return 'n/a';
  }
  return 'n/a';
}

async function fetchNewsTitles(slugs) {
  const items = [];
  for (const slug of slugs.slice(0, 12)) {
    try {
      const html = await fetchText(`${NEWS_BASE}${slug}`);
      const og = (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || [])[1] || '';
      const title = decodeEntities(og.replace(/\s*\|\s*DeepSeek API Docs\s*$/i, '') || slug);
      const date = parseNewsDateFromSlug(slug, html);
      items.push({ slug, url: `${NEWS_BASE}${slug}`, title, date });
    } catch (e) {
      console.warn(`news ${slug}: ${e.message}`);
    }
    await sleep(300);
  }
  return items;
}

// --- Source 2b: DeepSeek Official Website News (https://www.deepseek.com/en/news/) ---
function extractWebsiteSlugs(html) {
  const slugs = new Set();
  const re = /href="\/en\/news\/([^"/]+)\/"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].trim();
    if (slug && slug !== 'en' && !slug.startsWith('http')) slugs.add(slug);
  }
  // also handle zh path fallback
  const re2 = /href="\/news\/([^"/]+)\/"/g;
  while ((m = re2.exec(html)) !== null) {
    const slug = m[1].trim();
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

async function fetchWebsiteNews() {
  const html = await fetchText(WEBSITE_NEWS_URL);
  const slugs = extractWebsiteSlugs(html);
  const items = [];
  // Process up to 10 newest to stay within rate limits
  for (const slug of slugs.slice(0, 10)) {
    try {
      const pageUrl = `https://www.deepseek.com/en/news/${slug}/`;
      const pageHtml = await fetchText(pageUrl);
      const og = (pageHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || [])[1] || '';
      const title = decodeEntities(og.replace(/\s*\|\s*DeepSeek\s*$/i, '').trim() || slug.replace(/-/g, ' '));
      const pubMatch = pageHtml.match(/property="article:published_time"[^>]*content="([^"]+)"/i)
        || pageHtml.match(/<meta[^>]*name="pubdate"[^>]*content="([^"]+)"/i);
      let date = 'n/a';
      if (pubMatch) {
        const cand = pubMatch[1].slice(0, 10);
        if (isValidDate(cand)) date = cand;
      } else {
        // Fallback: extract date caption from page (e.g., <span>September 22, 2025</span>)
        const caption = pageHtml.match(/<span[^>]*class="[^"]*text-ds-description[^"]*"[^>]*>([A-Z][a-z]+ \d{1,2}, \d{4})<\/span>/);
        if (caption) {
          const parsed = new Date(caption[1]);
          if (!isNaN(parsed)) {
            const iso = parsed.toISOString().slice(0, 10);
            if (isValidDate(iso)) date = iso;
          }
        }
      }
      // Extract summary from og:description
      const desc = (pageHtml.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i) || [])[1] || '';
      items.push({ slug, url: pageUrl, title, date, summary: decodeEntities(desc).slice(0, 400) });
    } catch (e) {
      console.warn(`website-news ${slug}: ${e.message}`);
    }
    await sleep(350);
  }
  return items;
}

// --- Source 3: GitHub releases & tags ---
async function fetchReleases(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Add Accept header for GitHub API
  headers['Accept'] = 'application/vnd.github+json';
  headers['X-GitHub-Api-Version'] = '2022-11-28';
  const items = [];
  for (const repo of OFFICIAL_REPOS) {
    try {
      const [rel, tags] = await Promise.all([
        fetchText(`https://api.github.com/repos/${repo}/releases?per_page=5`, { headers }).then(JSON.parse),
        fetchText(`https://api.github.com/repos/${repo}/tags?per_page=5`, { headers }).then(JSON.parse),
      ]);
      for (const r of rel) {
        if (!r.tag_name) continue;
        items.push({ kind: 'release', repo, tag: r.tag_name, name: r.name || r.tag_name, published_at: r.published_at, url: r.html_url });
      }
      for (const t of tags) {
        if (!t.name) continue;
        items.push({ kind: 'tag', repo, tag: t.name, name: t.name, published_at: '', url: `https://github.com/${repo}/releases/tag/${t.name}` });
      }
    } catch (e) {
      console.warn(`releases ${repo}: ${e.message}`);
    }
    await sleep(220);
  }
  // Deduplicate within this batch to avoid release+tag duplicates with same tag
  const seen = new Set();
  const deduped = [];
  for (const it of items) {
    const key = `${it.repo}|${it.tag}|${it.kind}`;
    // Use repo|tag for dedup across kinds: prefer release over tag
    const simpleKey = `${it.repo}|${it.tag}`;
    if (seen.has(simpleKey)) continue;
    // If we have both release and tag with same tag, keep the release
    // Since we iterate releases first, tag will be skipped
    seen.add(simpleKey);
    deduped.push(it);
  }
  return deduped;
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

// --- Source 5: HuggingFace models ---
async function fetchHuggingFace() {
  const raw = await fetchText(HF_API, { headers: { Accept: 'application/json' } });
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('HF API unexpected shape');
  return data.map((m) => ({
    id: m.id || m.modelId,
    modelId: m.modelId || m.id,
    lastModified: m.lastModified || m.createdAt || '',
    likes: m.likes ?? 0,
    downloads: m.downloads ?? 0,
    tags: m.tags || [],
    pipeline: m.pipeline_tag || '',
  }));
}

// --- helpers ---
function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    // Migrate & deduplicate
    const dedupe = (arr) => [...new Set(arr || [])];
    return {
      changelog: dedupe(raw.changelog),
      news: dedupe(raw.news),
      websiteNews: dedupe(raw.websiteNews || []),
      releases: dedupe(raw.releases),
      npm: dedupe(raw.npm),
      huggingface: dedupe(raw.huggingface || []),
    };
  } catch {
    return { changelog: [], news: [], websiteNews: [], releases: [], npm: [], huggingface: [] };
  }
}

function saveState(state) {
  // Final dedupe before save
  for (const k of Object.keys(state)) {
    if (Array.isArray(state[k])) state[k] = [...new Set(state[k])];
  }
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
  const summary = { changelog: 0, news: 0, websiteNews: 0, releases: 0, npm: 0, huggingface: 0 };

  // 1. API changelog
  let changelogHtml = '';
  try {
    changelogHtml = await fetchText(CHANGELOG_URL);
    const entries = parseChangelog(changelogHtml);
    const seen = new Set(state.changelog);
    const fresh = entries.filter((e) => !seen.has(`${e.date}|${e.title}`));
    state.changelog.push(...fresh.map((e) => `${e.date}|${e.title}`));
    state.changelog = [...new Set(state.changelog)].slice(-600);
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
    state.news = [...new Set(state.news)].slice(-300);
    appendEntries(FILES.news, '# DeepSeek Official News', freshNews, (e) =>
      renderMarkdownEntry({ ...e, url: e.url })
    );
    summary.news = freshNews.length;
  } catch (e) {
    console.warn(`changelog/news: ${e.message}`);
  }

  // 2b. Website news (independent, not tied to changelog)
  try {
    const websiteItems = await fetchWebsiteNews();
    const seenW = new Set(state.websiteNews);
    const freshW = websiteItems.filter((w) => !seenW.has(w.slug));
    state.websiteNews.push(...freshW.map((w) => w.slug));
    state.websiteNews = [...new Set(state.websiteNews)].slice(-300);
    appendEntries(FILES.websiteNews, '# DeepSeek Official Website News (deepseek.com)', freshW, (e) =>
      renderMarkdownEntry({ ...e, url: e.url })
    );
    summary.websiteNews = freshW.length;
  } catch (e) {
    console.warn(`websiteNews: ${e.message}`);
  }

  // 3. GitHub releases & tags
  try {
    const releases = await fetchReleases(token);
    const seenRel = new Set(state.releases);
    const freshRel = releases.filter((r) => !seenRel.has(`${r.repo}|${r.tag}`));
    // Extra dedupe within freshRel (in case API returned dup)
    const uniqFresh = [];
    const innerSeen = new Set();
    for (const r of freshRel) {
      const k = `${r.repo}|${r.tag}`;
      if (innerSeen.has(k)) continue;
      innerSeen.add(k);
      uniqFresh.push(r);
    }
    state.releases.push(...uniqFresh.map((r) => `${r.repo}|${r.tag}`));
    state.releases = [...new Set(state.releases)].slice(-1200);
    appendEntries(FILES.releases, '# DeepSeek Official GitHub Releases & Tags', uniqFresh, (e) =>
      renderMarkdownEntry({ date: (e.published_at || '').slice(0, 10) || 'n/a', title: `${e.repo} ${e.kind} ${e.tag}`, summary: e.name, url: e.url })
    );
    summary.releases = uniqFresh.length;
  } catch (e) {
    console.warn(`releases: ${e.message}`);
  }

  // 4. npm package
  try {
    const npm = await fetchNpm();
    const seenVersions = new Set(state.npm);
    const freshVersions = npm.versions.filter((v) => !seenVersions.has(v));
    state.npm.push(...freshVersions);
    state.npm = [...new Set(state.npm)].slice(-150);
    appendEntries(FILES.npm, `# npm: ${NPM_PACKAGE}`, freshVersions, (v) =>
      renderMarkdownEntry({ date: (npm.time[v] || '').slice(0, 10) || 'n/a', title: `v${v}`, summary: v === npm.latest ? 'latest' : '', url: `https://www.npmjs.com/package/${NPM_PACKAGE}/v/${v}` })
    );
    summary.npm = freshVersions.length;
  } catch (e) {
    console.warn(`npm: ${e.message}`);
  }

  // 5. HuggingFace
  try {
    const hf = await fetchHuggingFace();
    const seenHf = new Set(state.huggingface);
    const freshHf = hf.filter((m) => !seenHf.has(m.modelId));
    state.huggingface.push(...freshHf.map((m) => m.modelId));
    state.huggingface = [...new Set(state.huggingface)].slice(-300);
    appendEntries(FILES.huggingface, '# HuggingFace: deepseek-ai Models', freshHf, (e) =>
      renderMarkdownEntry({
        date: (e.lastModified || '').slice(0, 10) || 'n/a',
        title: `${e.modelId}`,
        summary: `❤️ ${e.likes} · 📥 ${e.downloads.toLocaleString()} · ${e.pipeline || 'model'} · ${e.tags.slice(0, 5).join(', ')}`,
        url: `https://huggingface.co/${e.modelId}`,
      })
    );
    summary.huggingface = freshHf.length;
  } catch (e) {
    console.warn(`huggingface: ${e.message}`);
  }

  saveState(state);

  // Combined feed
  const allFiles = [FILES.changelog, FILES.news, FILES.websiteNews, FILES.releases, FILES.npm, FILES.huggingface].filter((f) => fs.existsSync(f));
  const sections = allFiles.map((f) => fs.readFileSync(f, 'utf8'));
  const allEntries = sections
    .flatMap((s) => [...s.matchAll(/^## \[([^\]]+)\] (.*)$/gm)].map((m) => {
      let d = m[1].trim();
      if (!isValidDate(d)) d = 'n/a';
      return { date: d, title: m[2].trim() };
    }))
    .sort((a, b) => {
      if (a.date === 'n/a' && b.date === 'n/a') return 0;
      if (a.date === 'n/a') return 1;
      if (b.date === 'n/a') return -1;
      return a.date < b.date ? 1 : -1;
    })
    .slice(0, 80);
  // Deduplicate titles in feed (keep first occurrence)
  const seenFeed = new Set();
  const dedupedFeed = [];
  for (const e of allEntries) {
    const k = `${e.date}|${e.title}`;
    if (seenFeed.has(k)) continue;
    seenFeed.add(k);
    dedupedFeed.push(e);
  }
  const feedHeader = `# DeepSeek Official Tracker Feed\n\n> Auto-generated by GitHub Actions — last update: ${now} (UTC). Sources: API changelog · API News · deepseek.com Blog · GitHub Releases · npm · HuggingFace.\n`;
  const feed = feedHeader + '\n' + dedupedFeed.map((e) => `- **${e.date}** ${e.title}`).join('\n') + '\n';
  fs.writeFileSync(path.join(ROOT, 'FEED.md'), feed);

  console.log(JSON.stringify({ now, ...summary }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
