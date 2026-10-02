#!/usr/bin/env node
/**
 * corners.mjs — multi-corner live signal collector for deep discovery
 *
 * Purpose: give the Discover agent a *deterministic, key-free* precomputed
 * signal set drawn from many independent sources, instead of relying solely on
 * new deepseek.com blog slugs (which was the only trigger, and which track.mjs
 * already consumes — so the gate was effectively always empty).
 *
 * Design rules:
 * - Every collector is independent and failure-tolerant: one dead endpoint must
 *   never break the run.
 * - No API key required. Uses public JSON/RSS endpoints only.
 * - Each signal gets a stable `id` so it can be diffed across runs and folded
 *   into a "seen" baseline. Ids are `<source>:<stable-key>`.
 * - `tier` marks trust level. Four tiers, ordered by how much they can be
 *   asserted without hedging:
 *     official   — first-party DeepSeek surface
 *     secondary  — authoritative reporting, not DeepSeek (media, arXiv, OpenRouter)
 *     community  — user-generated; leads, does not prove (HN, Reddit, X, GitHub forks)
 *     rumor      — forward-looking speculation about unreleased work. Collected
 *                  on purpose so it is dated and attributed rather than dropped,
 *                  and always labelled unverified / 疑似. Never a headline.
 *   The agent still re-verifies anything it wants to assert.
 *
 * Optional env: FIRECRAWL_API_KEY lifts the Firecrawl Keyless quota; every
 * Firecrawl corner degrades to a reported error when unset.
 *
 * Usage:
 *   node scripts/corners.mjs                 # print JSON of live signals
 *   import { collectSignals } from './corners.mjs'
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchExa } from './search-mcp.mjs';
import { parseProduct, PRODUCT_URL } from './products.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEEN_FILE = path.join(ROOT, 'data', 'discover-seen.json');

const UA = 'deepseek-official-tracker-corners/1.0';

const GITHUB_REPOS = [
  'deepseek-harness',
  'DeepSeek-V3',
  'DeepSeek-R1',
  'DeepSeek-V3.2-Exp',
  'DeepEP',
  'DeepGEMM',
  'FlashMLA',
  'TileKernels',
  'DeepSelect',
  'DeepJIT',
  'Engram',
  'EPLB',
  'DeepSpec',
  'DualPipe',
  '3FS',
];

// ---------------------------------------------------------------- utilities

async function get(url, opts = {}) {
  const headers = {
    'User-Agent': UA,
    'Accept': opts.accept || '*/*',
    ...(opts.headers || {}),
  };
  if (process.env.GITHUB_TOKEN && new URL(url).hostname === 'api.github.com') {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return opts.as === 'json' ? await res.json() : await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, opts = {}) {
  return get(url, { ...opts, as: 'json' });
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

function isValidDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return false;
  const y = Number(d.slice(0, 4));
  return y >= 2023 && y <= 2030;
}

function dayKey(ts) {
  try {
    const d = new Date(ts);
    return isValidDate(d.toISOString()) ? d.toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// ------------------------------------------------------------- collectors
// Each returns an array of signal objects:
//   { id, source, tier, title, date, url, detail }

async function collectWebsiteNews() {
  const html = await get('https://www.deepseek.com/en/news/', { accept: 'text/html' });
  const seen = new Set();
  const out = [];
  const push = (slug) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push({
      id: `blog:${slug}`,
      source: 'deepseek.com blog',
      tier: 'official',
      title: slug,
      date: null,
      url: `https://www.deepseek.com/en/news/${slug}/`,
      detail: 'New blog slug present on deepseek.com/en/news/ — fetch title+date.',
    });
  };
  for (const re of [/href="\/en\/news\/([^"/]+)\/"/g, /href="\/news\/([^"/]+)\/"/g]) {
    let m;
    while ((m = re.exec(html)) !== null) push(m[1].trim());
  }
  return out;
}

async function collectChangelog() {
  const html = await get('https://api-docs.deepseek.com/updates', { accept: 'text/html' });
  const out = [];
  const h2Re = /<h2[^>]*>\s*Date:\s*([0-9]{4}-[0-2-9][0-9]-[0-3][0-9])[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*>\s*Date:|$)/gi;
  let m;
  while ((m = h2Re.exec(html)) !== null) {
    const date = m[1];
    if (!isValidDate(date)) continue;
    const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;
    let t;
    while ((t = h3Re.exec(m[2])) !== null) {
      const title = stripHtml(t[1]).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s*[?#]\s*$/, '');
      if (!title) continue;
      const anchor = ((t[1].match(/id="([^"]+)"/) || [])[1] || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        .replace(/-+$/, '');
      out.push({
        id: `changelog:${date}:${anchor}`,
        source: 'API changelog',
        tier: 'official',
        title,
        date,
        url: `https://api-docs.deepseek.com/updates#${anchor}`,
        detail: stripHtml(t[2]).slice(0, 400),
      });
    }
  }
  return out;
}

async function collectGithubReleases() {
  const out = [];
  const results = await Promise.allSettled(
    GITHUB_REPOS.map(async (repo) => {
      const rels = await getJson(`https://api.github.com/repos/deepseek-ai/${repo}/releases?per_page=4`);
      const tags = await getJson(`https://api.github.com/repos/deepseek-ai/${repo}/tags?per_page=4`).catch(() => []);
      const items = [
        ...(Array.isArray(rels) ? rels.map(r => ({ tag: r.tag_name, date: r.published_at || r.created_at, url: r.html_url, kind: 'release', body: r.body || '' })) : []),
        ...(Array.isArray(tags) ? tags.map(t => ({ tag: t.name, date: null, url: `https://github.com/deepseek-ai/${repo}/releases/tag/${t.name}`, kind: 'tag', body: '' })) : []),
      ];
      return { repo, items };
    })
  );
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const it of r.value.items) {
      if (!it.tag) continue;
      out.push({
        id: `gh:${r.value.repo}:${it.tag}`,
        source: `GitHub ${r.value.repo} ${it.kind}`,
        tier: 'official',
        title: `${r.value.repo} ${it.tag}`,
        date: it.date ? dayKey(it.date) : null,
        url: it.url,
        detail: stripHtml(it.body).slice(0, 400),
      });
    }
  }
  return out;
}

async function collectGithubOrgRepos() {
  const repos = await getJson('https://api.github.com/orgs/deepseek-ai/repos?per_page=100&sort=pushed');
  if (!Array.isArray(repos)) return [];
  return repos
    .filter(r => !r.fork && !r.archived && r.pushed_at && r.pushed_at.slice(0, 10) >= daysAgo(10))
    .map(r => ({
      id: `ghrepo:${r.full_name}`,
      source: 'GitHub org repo',
      tier: 'official',
      title: r.full_name,
      date: dayKey(r.pushed_at),
      url: r.html_url,
      detail: `${r.description || 'no description'} — stars ${r.stargazers_count}, created ${dayKey(r.created_at) || 'n/a'}`,
    }));
}

async function collectHuggingFace() {
  const models = await getJson('https://huggingface.co/api/models?author=deepseek-ai&sort=lastModified&limit=15');
  if (!Array.isArray(models)) return [];
  return models.map(m => ({
    id: `hf:${m.modelId}`,
    source: 'HuggingFace',
    tier: 'official',
    title: m.modelId,
    date: dayKey(m.lastModified),
    url: `https://huggingface.co/${m.modelId}`,
    detail: `pipeline ${m.pipeline_tag || 'n/a'}, downloads ${m.downloads ?? 0}, likes ${m.likes ?? 0}, tags: ${(m.tags || []).slice(0, 8).join(', ')}`,
  }));
}

async function collectNpm() {
  const out = [];
  const meta = await getJson('https://registry.npmjs.org/@deepseek-ai/dsh');
  const dist = meta['dist-tags'] || {};
  for (const [tag, version] of Object.entries(dist)) {
    out.push({
      id: `npm:dsh:${tag}:${version}`,
      source: 'npm',
      tier: 'official',
      title: `@deepseek-ai/dsh dist-tag ${tag}`,
      date: dayKey(meta.time?.[version]),
      url: `https://www.npmjs.com/package/@deepseek-ai/dsh/v/${version}`,
      detail: `dist-tags: ${JSON.stringify(dist)}`,
    });
  }
  const search = await getJson('https://registry.npmjs.org/-/v1/search?text=%40deepseek-ai&size=20').catch(() => null);
  for (const o of search?.objects || []) {
    out.push({
      id: `npmsearch:${o.package.name}:${o.package.version}`,
      source: 'npm search',
      tier: 'official',
      title: o.package.name,
      date: dayKey(o.package.date),
      url: o.package.links?.npm || `https://www.npmjs.com/package/${o.package.name}`,
      detail: `${o.package.version} — ${o.package.description || ''}`.slice(0, 300),
    });
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function collectArxiv() {
  // arXiv aggressively rate-limits (429) and asks for a 3s gap between calls.
  // Retry a couple of times with backoff before giving up on this corner.
  const url = 'https://export.arxiv.org/api/query?search_query=ti:%22DeepSeek%22&sortBy=submittedDate&max_results=12';
  let xml = null;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      xml = await get(url, { accept: 'application/atom+xml', timeoutMs: 20000 });
      break;
    } catch (e) {
      lastErr = e;
      await sleep(3000 * (attempt + 1));
    }
  }
  if (xml == null) throw lastErr;
  const out = [];
  const entries = xml.split('<entry>').slice(1);
  for (const e of entries) {
    const title = stripHtml((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const id = ((e.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || '').trim();
    const published = ((e.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || '').trim();
    const summary = stripHtml((e.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || '').slice(0, 400);
    if (!title || !id) continue;
    out.push({
      id: `arxiv:${id}`,
      source: 'arXiv',
      tier: 'secondary',
      title,
      date: published ? dayKey(published) : null,
      url: id,
      detail: summary,
    });
  }
  return out;
}

async function collectHackerNews() {
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
  const res = await getJson(`https://hn.algolia.com/api/v1/search?query=deepseek&tags=story&numericFilters=created_at_i>${cutoff},points>15&hitsPerPage=15`);
  return (res.hits || []).map(h => ({
    id: `hn:${h.objectID}`,
    source: 'HackerNews',
    tier: 'community',
    title: h.title || h.story_title || '(untitled)',
    date: dayKey(h.created_at),
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    detail: `${h.points || 0} pts, ${h.num_comments || 0} comments`,
  }));
}

async function collectReddit() {
  const out = [];
  const subs = ['LocalLLaMA', 'deepseek', 'MachineLearning'];
  for (const sub of subs) {
    const res = await getJson(
      `https://www.reddit.com/r/${sub}/search.json?q=deepseek&sort=new&t=week&limit=15`,
      { headers: { 'User-Agent': `${UA} reddit-app` } }
    ).catch(() => null);
    for (const c of res?.data?.children || []) {
      const d = c.data || {};
      if (!d.title) continue;
      out.push({
        id: `reddit:${d.id}`,
        source: `r/${sub}`,
        tier: 'community',
        title: d.title,
        date: dayKey((d.created_utc || 0) * 1000),
        url: `https://www.reddit.com${d.permalink}`,
        detail: `${d.num_comments || 0} comments, score ${d.score || 0}`,
      });
    }
  }
  return out;
}

async function collectGoogleNews() {
  const xml = await get('https://news.google.com/rss/search?q=deepseek&hl=en-US&gl=US&ceid=US:en', {
    accept: 'application/rss+xml',
  });
  const out = [];
  for (const item of xml.split('<item>').slice(1, 21)) {
    const title = stripHtml((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = ((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
    const pub = ((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '').trim();
    if (!title || !link) continue;
    out.push({
      id: `gnews:${title.toLowerCase().slice(0, 80).replace(/\s+/g, '-')}`,
      source: 'Google News',
      tier: 'secondary',
      title,
      date: pub ? dayKey(pub) : null,
      url: link,
      detail: 'Media headline — find the first-party DeepSeek source before calling verified.',
    });
  }
  return out;
}

// ------------------------------------------- additional media / community tiers
//
// The original corners were English-only and official-leaning, so the agent kept
// re-discovering the same Chinese coverage from scratch and had no place to put
// a leak claim. These collectors fix both: real Chinese tech media as `secondary`
// (authoritative reporting, still not first-party), and forward-looking chatter
// as `rumor` — a tier that exists so speculation gets *recorded and dated*
// instead of either being dropped or laundered into a headline.
//
// Every one of these was probed live before being added; the ones that failed
// (机器之心 /rss/articles → 404, 36kr /feed → 0 items, lobste.rs/search.json →
// 400) are deliberately not here.

function parseRssItems(xml, { limit = 20 } = {}) {
  const out = [];
  for (const item of xml.split('<item>').slice(1, limit + 1)) {
    const pick = (tag) => {
      const raw = (item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '';
      // Feeds wrap payloads in CDATA; strip the wrapper or the whole title reads
      // as "<![CDATA[https://…]]>".
      return stripHtml(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
    };
    const title = pick('title');
    const link = pick('link');
    if (!title || !link) continue;
    out.push({ title, link, date: pick('pubDate'), description: pick('description') });
  }
  return out;
}

// A DeepSeek-mentioning item is the only reason to report a general tech feed.
const MENTIONS_DEEPSEEK = /deepseek|深度求索|dsh\b/i;

async function collectChineseTechMedia() {
  // Three independent Chinese tech outlets, all plain RSS, no key, no scraping.
  // Together they cover the 机器之心/量子位 class of reporting that Google News
  // only reaches intermittently and often with an opaque redirect link.
  const feeds = [
    ['量子位', 'https://www.qbitai.com/feed'],
    ['InfoQ 中国', 'https://www.infoq.cn/feed'],
    ['Solidot', 'https://www.solidot.org/index.rss'],
  ];
  const out = [];
  for (const [name, url] of feeds) {
    const xml = await get(url, { accept: 'application/rss+xml' }).catch(() => null);
    if (!xml) continue;
    for (const it of parseRssItems(xml, { limit: 40 })) {
      if (!MENTIONS_DEEPSEEK.test(`${it.title} ${it.description}`)) continue;
      let host = name;
      try { host = new URL(it.link).hostname; } catch { /* keep outlet name */ }
      out.push({
        id: `cnmedia:${host}:${it.title.toLowerCase().slice(0, 60).replace(/\s+/g, '-')}`,
        source: name,
        tier: 'secondary',
        title: it.title,
        date: it.date ? dayKey(it.date) : null,
        url: it.link,
        detail: it.description.slice(0, 260),
      });
    }
  }
  if (!out.length) throw new Error('no DeepSeek items in Chinese tech RSS');
  return out;
}

async function collectChineseGoogleNews() {
  // The zh-CN feed surfaces 国内报道 that the en-US feed ranks out, including the
  // 公众号/知乎 long-form pieces DeepSeek publishes outside its own blog.
  const queries = [
    ['zh', '深度求索', 'hl=zh-CN&gl=CN&ceid=CN:zh-Hans'],
    ['harness', '"DeepSeek Harness"', 'hl=zh-CN&gl=CN&ceid=CN:zh-Hans'],
  ];
  const out = [];
  for (const [tag, q, locale] of queries) {
    const xml = await get(
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${locale}`,
      { accept: 'application/rss+xml' }
    ).catch(() => null);
    if (!xml) continue;
    for (const item of xml.split('<item>').slice(1, 16)) {
      const title = stripHtml((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const link = ((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
      const pub = ((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '').trim();
      if (!title || !link) continue;
      out.push({
        id: `gnewszh:${tag}:${title.toLowerCase().slice(0, 70).replace(/\s+/g, '-')}`,
        source: 'Google News 中文',
        tier: 'secondary',
        title,
        date: pub ? dayKey(pub) : null,
        url: link,
        detail: '中文媒体报道 — 需回溯 deepseek.com / github.com/deepseek-ai 一手来源后才算已证实。',
      });
    }
  }
  if (!out.length) throw new Error('zh Google News returned nothing');
  return out;
}

// Rumours and leaks. Deliberately a separate tier: these are the highest-value
// early warnings and the highest-risk thing to state as fact, so they are kept
// in their own bucket where the prompt requires an explicit unverified label and
// the site renders them outside the numbered official system.
const RUMOUR_RE = /rumou?r|leak|leaked|speculat|unconfirmed|report(ed|s)?\b|传|传闻|泄露|消息人士|据报|即将|下个|下一代|计划|内测|preview|expected|said to be/i;

async function collectRumours() {
  const feeds = [
    ['en', 'deepseek rumor OR leak OR "next model" OR unconfirmed', 'hl=en-US&gl=US&ceid=US:en'],
    ['zh', 'deepseek 传闻 OR 泄露 OR 即将发布 OR 下一代', 'hl=zh-CN&gl=CN&ceid=CN:zh-Hans'],
  ];
  const cutoff = daysAgo(21);
  const out = [];
  for (const [tag, q, locale] of feeds) {
    const xml = await get(
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${locale}`,
      { accept: 'application/rss+xml' }
    ).catch(() => null);
    if (!xml) continue;
    for (const item of xml.split('<item>').slice(1, 25)) {
      const title = stripHtml((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const link = ((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
      const pub = ((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '').trim();
      const date = pub ? dayKey(pub) : null;
      if (!title || !link || !date || date < cutoff) continue;
      if (!RUMOUR_RE.test(title)) continue;
      out.push({
        id: `rumour:${tag}:${title.toLowerCase().slice(0, 70).replace(/\s+/g, '-')}`,
        source: tag === 'zh' ? '传闻聚合（中文）' : 'Rumour wire',
        tier: 'rumor',
        title,
        date,
        url: link,
        detail: '未经官方确认。可能是真的，也可能是过期或臆测 — 引用时必须标注 unverified / 疑似。',
      });
    }
  }
  if (!out.length) throw new Error('no rumour items matched');
  return out;
}

// Third-party ports, quant recipes and wrappers. These appear on GitHub days
// before DeepSeek's own post when a weights drop is imminent, and they are the
// most concrete "leak" evidence available without an official source.
//
// A repo-search also surfaces deepseek-ai/* itself, which is not community at
// all — a brand-new official repo is a first-party fact and belongs in the
// official tier. Filing those under "community" was wrong in the exact direction
// that matters: it would have labelled DeepSeek's own Ascend open-source drop
// (DeepGEMM-Ascend, DeepEP-Ascend, clangd-ascend) as third-party chatter.
async function collectCommunityRepos() {
  const queries = [
    ['weights', 'deepseek in:name created:>' + daysAgo(30)],
    ['next', 'deepseek-v4.2 OR deepseek-v5 OR deepseek-next created:>' + daysAgo(60)],
  ];
  const out = [];
  for (const [tag, q] of queries) {
    const res = await getJson(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=15`
    ).catch(() => null);
    for (const r of res?.items || []) {
      const firstParty = /^deepseek-ai\//i.test(r.full_name || '');
      out.push({
        id: `ghcommunity:${tag}:${r.full_name}`,
        source: firstParty ? 'GitHub (deepseek-ai)' : 'GitHub (community)',
        tier: firstParty ? 'official' : 'community',
        title: firstParty
          ? `${r.full_name} — new official repo`
          : `${r.full_name} — ${(r.description || 'no description').slice(0, 120)}`,
        date: dayKey(r.created_at),
        url: r.html_url,
        detail: firstParty
          ? `★${r.stargazers_count}, created ${dayKey(r.created_at)} — a first-party DeepSeek repository not yet in OFFICIAL_REPOS. Verify it appears in track.mjs before treating it as tracked news.`
          : `★${r.stargazers_count}, created ${dayKey(r.created_at)}, pushed ${dayKey(r.pushed_at)}. Third-party — port/quant work often precedes an official weights drop.`,
      });
    }
  }
  if (!out.length) throw new Error('community repo search returned nothing');
  return out;
}

// V2EX is the highest-signal Chinese developer forum for DeepSeek specifically,
// and its API needs no key. hot.json is a bare array of 10 topics — no envelope,
// no paging — so a miss is a genuinely quiet day rather than a parse bug.
async function collectV2ex() {
  const res = await getJson('https://www.v2ex.com/api/topics/hot.json');
  if (!Array.isArray(res)) throw new Error('v2ex hot.json was not an array');
  const out = [];
  for (const t of res) {
    if (!MENTIONS_DEEPSEEK.test(`${t.title || ''} ${t.content || ''}`)) continue;
    out.push({
      id: `v2ex:${t.id}`,
      source: 'V2EX',
      tier: 'community',
      title: t.title,
      date: dayKey((t.created || 0) * 1000),
      url: `https://www.v2ex.com/t/${t.id}`,
      detail: `${t.member?.username || 'unknown'} · ${t.replies || 0} replies`,
    });
  }
  // Deliberately returns [] rather than throwing on no match. The discover gate
  // treats >2 corner errors as "degraded" and runs anyway, so a day when V2EX
  // simply has no DeepSeek topic must not be reported as a dead endpoint — the
  // throw is reserved for a fetch that actually failed.
  return out;
}

async function collectPyPi() {
  const res = await getJson('https://pypi.org/pypi/deepseek/json').catch(() => null);
  const version = res?.info?.version;
  if (!version) return [];
  const files = res.releases?.[version] || [];
  return [{
    id: `pypi:deepseek:${version}`,
    source: 'PyPI',
    tier: 'secondary',
    title: `pypi deepseek ${version}`,
    date: files[0] ? dayKey(files[0].upload_time_iso_8601 || files[0].upload_time) : null,
    url: 'https://pypi.org/project/deepseek/',
    detail: `${res.info?.summary || ''}`.slice(0, 300),
  }];
}

async function collectOpenRouter() {
  const res = await getJson('https://openrouter.ai/api/v1/models').catch(() => null);
  const models = (res?.data || []).filter(m => /deepseek/i.test(m.id));
  return models
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, 12)
    .map(m => ({
      id: `openrouter:${m.id}`,
      source: 'OpenRouter',
      tier: 'secondary',
      title: m.id,
      date: m.created ? dayKey(new Date(m.created * 1000).toISOString()) : null,
      url: `https://openrouter.ai/${m.id}`,
      detail: `${m.context_length ? `${m.context_length} ctx` : ''} ${m.pricing?.prompt ? `in $${m.pricing.prompt}` : ''} ${m.pricing?.completion ? `out $${m.pricing.completion}` : ''}`.trim(),
    }));
}

// ------------------------------------------------- Firecrawl Keyless corners
//
// Firecrawl Keyless (https://www.firecrawl.dev/blog/firecrawl-keyless-launch)
// serves search and scrape with no API key, 1000 free credits/month. Verified
// working here: it renders x.com timelines, which s.jina.ai can no longer do
// (401 key-gated) and the remote browser can only do slowly.
//
// Known limit found in testing: Reddit returns 403 through Firecrawl as well as
// directly — Reddit blocks datacentre IPs outright. Site-scoped search is the
// working substitute, so collectReddit keeps its own paths and we add search
// rather than pretending scrape works.
//
// Optional: if FIRECRAWL_API_KEY is set the same endpoints get a higher quota.
// Everything here degrades to a reported error when Firecrawl is unreachable.

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';

// Firecrawl Keyless is rate-limited per IP on the free tier and returns 429
// under exactly the kind of back-to-back calls a collector run makes. Retry
// with backoff, then give up cleanly so the corner reports an error instead of
// failing the run.
async function firecrawl(endpoint, body, { attempts = 3, baseDelayMs = 4000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.FIRECRAWL_API_KEY) headers.Authorization = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(baseDelayMs * attempt);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40000);
    try {
      const res = await fetch(`${FIRECRAWL_API}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.status === 429) throw new Error('firecrawl 429 rate limited');
      if (!res.ok) throw new Error(`firecrawl ${endpoint} -> HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

// X/Twitter timeline — the single highest-value community source, and the one
// no other key-free endpoint can reach.
async function collectXTimeline() {
  const data = await firecrawl('scrape', { url: 'https://x.com/deepseek_ai' });
  const md = data?.data?.markdown || '';
  if (!md) throw new Error('firecrawl scrape returned no markdown');
  const out = [];
  const posts = md.split(/###\s*\d+\.\s*Post/).slice(1);
  for (const raw of posts.slice(0, 12)) {
    // Firecrawl escapes markdown-significant chars inside values, so a posted
    // date arrives as 2026\-09\-10T06:10:09\.000Z. Unescape before matching or
    // the character class swallows the timestamp's tail.
    const post = raw.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1');
    const url = ((post.match(/URL:\s*\[([^\]]*)\]\((https:\/\/x\.com\/[^)]+)\)/) || [])[2])
      || ((post.match(/https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+/) || [])[0]);
    const posted = (post.match(/Posted:\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
    // Body lives in the blockquote between the metadata and the engagement line.
    const quoted = [...post.matchAll(/^>\s?(.*)$/gm)].map(m => m[1]).join(' ').trim();
    const engagement = (post.match(/Likes:\s*([\d,]+)\s*\|\s*Retweets:\s*([\d,]+)/) || []);
    const body = stripHtml(quoted).replace(/\s+/g, ' ').trim();
    if (!url) continue;
    const id = url.match(/status\/(\d+)/)?.[1] || url.slice(-24);
    out.push({
      id: `x:${id}`,
      source: 'X @deepseek_ai',
      tier: 'community',
      title: body.slice(0, 200) || '(no text)',
      date: posted,
      url,
      detail: engagement[1]
        ? `${engagement[1]} likes, ${engagement[2]} retweets — official account; still unverified until an official source page confirms it.`
        : 'Official account — still unverified until an official source page confirms it.',
    });
  }
  if (!out.length) throw new Error('firecrawl x scrape produced no posts');
  return out;
}

// Site-scoped web search — covers Reddit, WeChat relays, and Chinese media,
// which direct fetches and Reddit's own JSON both refuse.
async function collectFirecrawlSearch() {
  const queries = [
    ['reddit', 'site:reddit.com/r/LocalLLaMA deepseek'],
    ['reddit-deepseek', 'site:reddit.com deepseek release'],
    ['cn-media', 'deepseek 官方发布 新模型'],
  ];
  const out = [];
  // Sequential with a gap: the keyless tier rate-limits per IP, and firing the
  // three queries back to back is what trips it.
  for (const [tag, query] of queries) {
    const data = await firecrawl('search', { query, limit: 6 });
    await sleep(1500);
    for (const hit of data?.data || []) {
      if (!hit.url || !hit.title) continue;
      out.push({
        id: `fcsearch:${tag}:${hit.url.slice(0, 120)}`,
        source: `Firecrawl search (${tag})`,
        tier: 'community',
        title: hit.title,
        date: dayKey(hit.date || hit.metadata?.date),
        url: hit.url,
        detail: stripHtml(hit.description || hit.markdown || '').slice(0, 280),
      });
    }
  }
  if (!out.length) throw new Error('firecrawl search returned nothing');
  return out;
}

// ------------------------------------------------------------------ runner

async function collectExa(query, tier) {
  const results = await searchExa(query, { since: daysAgo(30) });
  return results.filter(hit => hit.url && hit.title).map(hit => ({
    id: `exa:${tier}:${hit.url}`,
    source: `Exa · ${new URL(hit.url).hostname}`,
    tier, // Search results are leads, including results on first-party domains.
    title: hit.title,
    date: dayKey(hit.publishedDate), // Never substitute crawl time for publication.
    url: hit.url,
    detail: stripHtml(hit.text || '').slice(0, 280),
  }));
}

const COLLECTORS = [
  ['harness-product', async () => {
    const product = parseProduct(await get(PRODUCT_URL));
    return [{ id: `product:harness:${product.fingerprint}`, tier: 'official', source: 'Harness product page',
      title: product.title, date: product.published, url: PRODUCT_URL,
      detail: `${product.summary} Publication date is unknown unless explicitly stated; observation is not launch.` }];
  }],
  ['website-news', collectWebsiteNews],
  ['api-changelog', collectChangelog],
  ['github-releases', collectGithubReleases],
  ['github-org-repos', collectGithubOrgRepos],
  ['huggingface', collectHuggingFace],
  ['npm', collectNpm],
  ['arxiv', collectArxiv],
  ['hackernews', collectHackerNews],
  ['reddit', collectReddit],
  ['google-news', collectGoogleNews],
  ['google-news-zh', collectChineseGoogleNews],
  ['cn-tech-media', collectChineseTechMedia],
  ['rumours', collectRumours],
  ['community-repos', collectCommunityRepos],
  ['v2ex', collectV2ex],
  ['pypi', collectPyPi],
  ['openrouter', collectOpenRouter],
  ['x-timeline', collectXTimeline],
  ['firecrawl-search', collectFirecrawlSearch],
  ['exa-news', () => collectExa('DeepSeek Harness desktop release plugins automation 昇腾 开源 最新新闻', 'secondary')],
  ['exa-community', () => collectExa('DeepSeek Harness latest developer discussions Reddit LocalLLaMA V2EX experiences', 'community')],
  ['exa-rumours', () => collectExa('DeepSeek upcoming model leak rumor 疑似 传闻 爆料', 'rumor')],
];

/**
 * Collect all live signals. Never throws; per-corner failures are reported in
 * `errors` so the caller can tell "nothing new" apart from "corner broke".
 */
export async function collectSignals() {
  const entries = await Promise.allSettled(COLLECTORS.map(([, fn]) => fn()));
  const signals = [];
  const errors = [];
  COLLECTORS.forEach(([name], i) => {
    const r = entries[i];
    if (r.status === 'fulfilled') signals.push(...r.value);
    else errors.push(`${name}: ${r.reason?.message || r.reason}`);
  });
  // Dedup by id, keeping first occurrence
  const byId = new Map();
  for (const s of signals) if (!byId.has(s.id)) byId.set(s.id, s);
  return { signals: [...byId.values()], errors };
}

// ------------------------------------------------------------- seen baseline

export function loadSeen(file = SEEN_FILE) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ids: new Set(raw.ids || []), updatedAt: raw.updatedAt || null };
  } catch {
    return { ids: new Set(), updatedAt: null };
  }
}

export function saveSeen(ids, extra = {}, file = SEEN_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const arr = [...new Set(ids)].sort();
  fs.writeFileSync(
    file,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), count: arr.length, ids: arr, ...extra }, null, 2)}\n`,
    'utf8'
  );
  console.log(`[corners] seen baseline saved: ${arr.length} ids -> ${path.relative(ROOT, file)}`);
}

export { SEEN_FILE, stripHtml };

// ------------------------------------------------------------------- CLI

async function main() {
  const { signals, errors } = await collectSignals();
  const seen = loadSeen();
  const fresh = signals.filter(s => !seen.ids.has(s.id));
  const byTier = fresh.reduce((acc, s) => {
    (acc[s.tier] ||= []).push(s);
    return acc;
  }, {});
  console.log(`[corners] total signals: ${signals.length}`);
  console.log(`[corners] seen baseline: ${seen.ids.size} ids (updated ${seen.updatedAt || 'never'})`);
  console.log(`[corners] FRESH (not yet reported): ${fresh.length}`);
  for (const [tier, list] of Object.entries(byTier)) {
    console.log(`\n--- ${tier} (${list.length}) ---`);
    for (const s of list.slice(0, 25)) {
      console.log(`  [${s.source}] ${s.date || '????-??-??'} ${s.title}`);
      console.log(`     ${s.url}`);
    }
  }
  if (errors.length) {
    console.log(`\n[corners] ERRORS (${errors.length}):`);
    for (const e of errors) console.log(`  ! ${e}`);
  }
  if (process.argv.includes('--json')) {
    fs.writeFileSync(path.join(ROOT, '.corners.json'), `${JSON.stringify({ signals, fresh, errors }, null, 2)}\n`, 'utf8');
    console.log('\n[corners] wrote .corners.json');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
