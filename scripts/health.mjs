import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HEALTH_FILE = path.join(ROOT, 'data', 'health.json');

const DATA_FILES = [
  'NEWS.md',
  'api-changelog.md',
  'website-news.md',
  'releases.md',
  'npm.md',
  'huggingface.md',
];
// Only these hosts get live-checked (x/reddit etc. block bots → false alarms)
const CHECKABLE_HOSTS = [
  'api-docs.deepseek.com',
  'www.deepseek.com',
  'deepseek.com',
  'github.com',
  'huggingface.co',
  'www.npmjs.com',
  'registry.npmjs.org',
];
const MAX_LINK_CHECKS = 15;

function isValidDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  if (m < 1 || m > 12 || day < 1 || day > 31 || y < 2023 || y > 2030) return false;
  return true;
}

function parseEntries(md) {
  const headers = [...md.matchAll(/^## \[([^\]]+)\] (.*)$/gm)];
  return headers.map((m, i) => {
    const end = i + 1 < headers.length ? headers[i + 1].index : md.length;
    const chunk = md.slice(m.index, end);
    const urlM = chunk.match(/\[Source\]\(([^)]+)\)/);
    return { date: (m[1] || '').trim(), title: (m[2] || '').trim(), url: urlM ? urlM[1] : '' };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'deepseek-official-tracker-health/1.0' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    return res.ok ? '' : `HTTP ${res.status}`;
  } catch (e) {
    return e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 80);
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const issues = [];
  const stats = {};

  // 1. dates + duplicates per data file
  for (const f of DATA_FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { issues.push(`${f}: missing file`); continue; }
    const entries = parseEntries(fs.readFileSync(p, 'utf8'));
    stats[f] = entries.length;
    const seen = new Set();
    for (const e of entries) {
      if (e.date !== 'n/a' && !isValidDate(e.date)) issues.push(`${f}: bad date "${e.date}" in "${e.title.slice(0, 60)}"`);
      if (!e.url) issues.push(`${f}: missing [Source] in "${e.title.slice(0, 60)}"`);
      const k = `${e.date}|${e.title}`;
      if (seen.has(k)) issues.push(`${f}: duplicate entry "${e.title.slice(0, 60)}"`);
      seen.add(k);
    }
  }

  // 2. state.json dedup
  try {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'state.json'), 'utf8'));
    for (const [k, v] of Object.entries(state)) {
      if (Array.isArray(v) && new Set(v).size !== v.length) issues.push(`state.json: duplicates in "${k}"`);
    }
    stats.state = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v.length]));
  } catch (e) {
    issues.push(`state.json: unreadable (${e.message.slice(0, 60)})`);
  }

  // 3. FEED.md shape
  try {
    const feed = fs.readFileSync(path.join(ROOT, 'FEED.md'), 'utf8');
    const items = [...feed.matchAll(/^- \*\*(.+?)\*\* (.+)$/gm)];
    stats.feedItems = items.length;
    if (items.length > 80) issues.push(`FEED.md: ${items.length} items exceeds 80 cap`);
    if (!/last update: \d{4}-\d{2}-\d{2}T/.test(feed)) issues.push('FEED.md: header timestamp malformed');
  } catch (e) {
    issues.push(`FEED.md: unreadable (${e.message.slice(0, 60)})`);
  }

  // 4. EN/ZH README Latest sync
  try {
    const en = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const zh = fs.readFileSync(path.join(ROOT, 'README.zh.md'), 'utf8');
    const enD = (en.match(/^## 🔥 Latest —.*\((\d{4}-\d{2}-\d{2})\)/m) || [])[1] || '';
    const zhD = (zh.match(/^## 🔥 最新 —.*\((\d{4}-\d{2}-\d{2})\)/m) || [])[1] || '';
    stats.readmeLatest = { en: enD, zh: zhD };
    if (!enD || !zhD) issues.push('README: Latest header date unparseable (syncReadmes pattern changed?)');
    else if (enD !== zhD) issues.push(`README: EN/ZH Latest drift (en=${enD} zh=${zhD})`);
    const prev = (md, re) => [...md.matchAll(re)].map((m) => m[1]);
    const enPrev = prev(en, /^- \*\*(\d{4}-\d{2}-\d{2})\*\* /gm).join(',');
    const zhPrev = prev(zh, /^- \*\*(\d{4}-\d{2}-\d{2})\*\* /gm).join(',');
    if (enPrev !== zhPrev) issues.push('README: EN/ZH Previous-highlights date lists differ');
  } catch (e) {
    issues.push(`README: unreadable (${e.message.slice(0, 60)})`);
  }

  // 5. live-check most recent primary-source links (bounded, checkable hosts only)
  const candidates = [];
  for (const f of ['api-changelog.md', 'NEWS.md', 'website-news.md']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const e of parseEntries(fs.readFileSync(p, 'utf8'))) {
      if (!e.url) continue;
      let host = '';
      try { host = new URL(e.url).hostname; } catch { continue; }
      if (CHECKABLE_HOSTS.includes(host)) candidates.push({ file: f, title: e.title.slice(0, 50), url: e.url });
    }
  }
  const sample = candidates.slice(0, MAX_LINK_CHECKS);
  stats.linksChecked = sample.length;
  for (const c of sample) {
    const err = await checkUrl(c.url);
    if (err) issues.push(`link ${err}: ${c.url} (${c.file}: ${c.title})`);
    await sleep(200);
  }

  const now = new Date().toISOString();
  const report = { checkedAt: now, ok: issues.length === 0, issueCount: issues.length, issues, stats };

  // No-churn write: identical issues ⇒ keep previous file byte-for-byte (no empty commit)
  let prevRaw = '';
  try { prevRaw = fs.readFileSync(HEALTH_FILE, 'utf8'); } catch {}
  const prevIssues = (() => { try { return JSON.parse(prevRaw).issues || null; } catch { return null; } })();
  if (JSON.stringify(prevIssues) === JSON.stringify(issues) && prevRaw) {
    console.log(`health: ${issues.length ? issues.length + ' known issue(s), unchanged' : 'OK'} — no file change (no churn)`);
  } else {
    fs.writeFileSync(HEALTH_FILE, JSON.stringify(report, null, 2) + '\n');
    console.log(`health: ${issues.length ? 'FAIL' : 'OK'} — ${issues.length} issue(s), wrote data/health.json`);
  }
  for (const i of issues) console.log(`  - ${i}`);
  console.log(`HEALTH_ISSUES=${issues.length}`);
  process.exitCode = issues.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(2); });
