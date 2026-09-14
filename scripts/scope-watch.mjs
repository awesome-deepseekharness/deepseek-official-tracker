import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TRACK_FILE = path.join(ROOT, 'scripts', 'track.mjs');
const README_EN = path.join(ROOT, 'README.md');
const README_ZH = path.join(ROOT, 'README.zh.md');

const ORG_REPOS_URL = 'https://api.github.com/orgs/deepseek-ai/repos?per_page=100&sort=created&direction=desc';
const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search?text=%40deepseek-ai&size=20';
// Only auto-propose repos pushed within this window (active, not stale mirrors)
const ACTIVE_DAYS = 180;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { timeoutMs = 15000, retries = 2 } = {}) {
  const token = process.env.GITHUB_TOKEN || '';
  const headers = { 'User-Agent': 'deepseek-official-tracker-scope-watch/1.0' };
  if (token && url.includes('api.github.com')) headers.Authorization = `Bearer ${token}`;
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, redirect: 'follow', signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 403 || res.status === 429) {
        const reset = res.headers.get('x-ratelimit-reset');
        throw new Error(`rate limited (${res.status}${reset ? `, resets ${new Date(Number(reset) * 1000).toISOString()}` : ''})`);
      }
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt <= retries) await sleep(attempt * 800);
    }
  }
  throw lastErr;
}

// --- pure functions (covered by scope-watch.test.mjs) ---
export function parseOfficialRepos(trackSrc) {
  const m = trackSrc.match(/const OFFICIAL_REPOS = \[([\s\S]*?)\];/);
  if (!m) throw new Error('OFFICIAL_REPOS block not found in track.mjs');
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

export function findCandidates(orgRepos, tracked, now = Date.now()) {
  const known = new Set(tracked);
  const cutoff = now - ACTIVE_DAYS * 24 * 3600 * 1000;
  return (Array.isArray(orgRepos) ? orgRepos : [])
    .filter((r) => r && typeof r.full_name === 'string')
    .filter((r) => !known.has(r.full_name))
    .filter((r) => !r.fork && !r.archived)
    .filter((r) => r.full_name !== 'deepseek-ai/.github')
    .filter((r) => r.pushed_at && new Date(r.pushed_at).getTime() >= cutoff)
    .map((r) => ({
      repo: r.full_name,
      pushed_at: (r.pushed_at || '').slice(0, 10),
      stars: r.stargazers_count ?? 0,
      description: (r.description || '').slice(0, 160),
      url: r.html_url || `https://github.com/${r.full_name}`,
    }))
    .sort((a, b) => (a.pushed_at < b.pushed_at ? 1 : -1));
}

export function insertReposSorted(trackSrc, newRepos) {
  const m = trackSrc.match(/const OFFICIAL_REPOS = \[([\s\S]*?)\];/);
  if (!m) throw new Error('OFFICIAL_REPOS block not found in track.mjs');
  const existing = parseOfficialRepos(trackSrc);
  const merged = [...new Set([...existing, ...newRepos])].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const indent = "  ";
  const body = merged.map((r) => `${indent}'${r}',`).join('\n');
  return trackSrc.replace(m[0], `const OFFICIAL_REPOS = [\n${body}\n];`);
}

export function syncRepoCounts(readmeEn, readmeZh, count) {
  return [
    readmeEn
      .replace(/\d+ repos: `DeepSeek-V3`/, `${count} repos: \`DeepSeek-V3\``)
      .replace(/\(25 today\)|\((\d+) today\)/, `(${count} today)`),
    readmeZh
      .replace(/\d+ 个仓库：`DeepSeek-V3`/, `${count} 个仓库：\`DeepSeek-V3\``)
      .replace(/（目前 \d+ 个）/, `（目前 ${count} 个）`),
  ];
}

function reportTable(cands, npmPkgs) {
  const lines = [];
  if (cands.length) {
    lines.push(`Found ${cands.length} untracked official repo(s):`, '');
    for (const c of cands) {
      lines.push(`- **${c.repo}** (pushed ${c.pushed_at}, ⭐ ${c.stars}) — ${c.description || 'no description'}`);
      lines.push(`  ${c.url}`);
    }
  } else {
    lines.push('No untracked official repos — scope is current.');
  }
  if (npmPkgs.length) {
    lines.push('', `npm @deepseek-ai packages seen (${npmPkgs.length}): ${npmPkgs.join(', ')}`,
      '(tracked package stays `@deepseek-ai/dsh` unless a human decides otherwise)');
  }
  return lines.join('\n');
}

async function main() {
  const apply = process.argv.includes('--apply');
  let orgRepos = null;
  let npmPkgs = [];
  try {
    orgRepos = await fetchJson(ORG_REPOS_URL);
  } catch (e) {
    console.warn(`scope-watch: org repos fetch failed (${e.message}) — skipping without changes`);
    console.log('SCOPE_CANDIDATES=0');
    return;
  }
  try {
    const npm = await fetchJson(NPM_SEARCH_URL);
    npmPkgs = (npm.objects || []).map((o) => o.package?.name).filter(Boolean);
  } catch (e) {
    console.warn(`scope-watch: npm search failed (${e.message}) — continuing without npm data`);
  }

  const trackSrc = fs.readFileSync(TRACK_FILE, 'utf8');
  const tracked = parseOfficialRepos(trackSrc);
  const cands = findCandidates(orgRepos, tracked);
  console.log(reportTable(cands, npmPkgs));
  console.log(`SCOPE_CANDIDATES=${cands.length}`);
  console.log(`SCOPE_TRACKED=${tracked.length}`);

  if (apply && cands.length) {
    const next = insertReposSorted(trackSrc, cands.map((c) => c.repo));
    fs.writeFileSync(TRACK_FILE, next);
    const count = parseOfficialRepos(next).length;
    const [en, zh] = syncRepoCounts(
      fs.readFileSync(README_EN, 'utf8'),
      fs.readFileSync(README_ZH, 'utf8'),
      count
    );
    fs.writeFileSync(README_EN, en);
    fs.writeFileSync(README_ZH, zh);
    console.log(`scope-watch: applied ${cands.length} repo(s) to OFFICIAL_REPOS (now ${count}), README counts synced`);
  } else if (apply) {
    // No candidates, but counts in docs may have drifted (e.g. 25 vs actual 24) — heal them.
    const [en0, zh0] = [fs.readFileSync(README_EN, 'utf8'), fs.readFileSync(README_ZH, 'utf8')];
    const [en, zh] = syncRepoCounts(en0, zh0, tracked.length);
    if (en !== en0) fs.writeFileSync(README_EN, en);
    if (zh !== zh0) fs.writeFileSync(README_ZH, zh);
    if (en !== en0 || zh !== zh0) console.log(`scope-watch: healed README repo counts → ${tracked.length}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
