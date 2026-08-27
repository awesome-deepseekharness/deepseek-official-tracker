import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT, 'site');

function readIfExists(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function mdToHtml(md) {
  // Minimal markdown to html for FEED: keep it simple, escape and linkify
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## \[(.+)\] (.+)$/gm, '<h2><span class="date">$1</span> $2</h2>')
    .replace(/\[Source\]\(([^)]+)\)/g, '<a href="$1" target="_blank" rel="noopener">Source</a>')
    .replace(/^- \*\*(.+?)\*\* (.+)$/gm, '<li><strong>$1</strong> $2</li>')
    .replace(/\n\n/g, '<br/>');
}

function build() {
  fs.mkdirSync(SITE_DIR, { recursive: true });
  const feed = readIfExists(path.join(ROOT, 'FEED.md'));
  const websiteNews = readIfExists(path.join(ROOT, 'website-news.md'));
  const hf = readIfExists(path.join(ROOT, 'huggingface.md'));
  const insights = readIfExists(path.join(ROOT, 'insights.md'));
  const now = new Date().toISOString();

  // Extract FEED items for JSON
  const feedItems = [...feed.matchAll(/^- \*\*(.+?)\*\* (.+)$/gm)].map(m => ({ date: m[1], title: m[2] })).slice(0, 80);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>DeepSeek Official Tracker — 6 sources, auto-updated, verifiable</title>
<meta name="description" content="Auto-tracked feed of DeepSeek official news, API changelog, deepseek.com blog, GitHub releases, HuggingFace models and npm dsh — updated every 6h. No hallucinations."/>
<meta name="keywords" content="deepseek, deepseek api, deepseek v4, deepseek v3.2, deepseek r1, deepseek harness, deepseek official, deepseek news, deepseek changelog, huggingface, dsh"/>
<link rel="canonical" href="https://awesome-deepseekharness.github.io/deepseek-official-tracker/"/>
<meta property="og:title" content="DeepSeek Official Tracker"/>
<meta property="og:description" content="The most complete, verifiable DeepSeek official feed — 6 sources, GitHub Actions every 6h."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://awesome-deepseekharness.github.io/deepseek-official-tracker/"/>
<meta property="og:image" content="https://opengraph.githubassets.com/1/awesome-deepseekharness/deepseek-official-tracker"/>
<meta name="twitter:card" content="summary_large_image"/>
<style>
:root{--c:#0b57d0;--bg:#f8fafc;--card:#fff;--muted:#667085}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 ui-sans,system-ui,Segoe UI,Roboto,Helvetica,Arial;background:var(--bg);color:#111}
a{color:var(--c);text-decoration:none}a:hover{text-decoration:underline}
header{background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:10}
.wrap{max-width:1100px;margin:0 auto;padding:18px 20px}
.hero{padding:28px 20px}
h1{margin:0;font-size:28px} .sub{color:var(--muted);margin-top:6px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px;margin-right:6px}
.grid{display:grid;grid-template-columns:1fr 340px;gap:18px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid #e5e7eb;border-radius:14px;padding:16px}
.feed li{margin:6px 0} .date{color:var(--muted);font-size:13px}
h2{font-size:16px;margin:14px 0 6px}
footer{color:var(--muted);font-size:13px;padding:20px;text-align:center}
code{background:#f3f4f6;padding:1px 5px;border-radius:4px}
</style>
</head>
<body>
<header><div class="wrap" style="display:flex;justify-content:space-between;align-items:center">
  <strong>DeepSeek Official Tracker</strong>
  <nav style="font-size:13px"><a href="https://github.com/awesome-deepseekharness/deepseek-official-tracker">GitHub</a> · <a href="https://github.com/awesome-deepseekharness/deepseek-official-tracker/blob/main/FEED.md">FEED.md</a> · <a href="feed.json">feed.json</a></nav>
</div></header>
<div class="wrap hero">
  <h1>DeepSeek Official Tracker</h1>
  <div class="sub">6 official sources · auto-updated every 6h · 100% verifiable · <span class="badge">FEED</span><span class="badge">API changelog</span><span class="badge">deepseek.com blog</span><span class="badge">GitHub</span><span class="badge">HuggingFace</span><span class="badge">npm dsh</span></div>
  <p>The most complete, automated &amp; verifiable feed for every DeepSeek official update — no rumors, no hallucinations. Sister: <a href="https://github.com/awesome-deepseekharness/awesome-deepseek-harness">Awesome DeepSeek Harness</a></p>
  <p style="font-size:13px;color:var(--muted)">Last build: ${now} UTC · Sources: api-docs.deepseek.com/updates · api-docs.deepseek.com/news · deepseek.com/en/news · github.com/deepseek-ai · huggingface.co/deepseek-ai · registry.npmjs.org/@deepseek-ai/dsh</p>
</div>
<div class="wrap grid">
  <div>
    <div class="card">
      <h2>📡 Latest Feed (FEED.md, newest first)</h2>
      <ul class="feed" style="padding-left:18px">
        ${feedItems.map(i=>`<li><strong>${i.date}</strong> ${i.title}</li>`).join('\n        ')}
      </ul>
      <p style="font-size:13px"><a href="https://github.com/awesome-deepseekharness/deepseek-official-tracker/blob/main/FEED.md">View full FEED.md on GitHub →</a></p>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>🤖 AI Insights (experimental, via PR)</h2>
      <div style="font-size:13px;white-space:pre-wrap;max-height:420px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fafafa">${(insights.slice(0, 4000) || 'No insights yet — run Discover workflow.').replace(/</g,'&lt;')}</div>
      <p style="font-size:12px;color:var(--muted)">Generated by <code>scripts/discover.mjs</code> with free-model traversal (<code>opencode/*-free</code>). Always via PR for human review.</p>
    </div>
  </div>
  <div>
    <div class="card">
      <h2>🔔 Subscribe</h2>
      <p><strong>Watch</strong> the GitHub repo (Custom → all) → email within 6h.</p>
      <p><code>curl -s https://raw.githubusercontent.com/awesome-deepseekharness/deepseek-official-tracker/main/FEED.md</code></p>
      <p><code>curl -s https://awesome-deepseekharness.github.io/deepseek-official-tracker/feed.json</code></p>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>📑 Sources</h2>
      <ul style="padding-left:18px;font-size:14px">
        <li><a href="https://api-docs.deepseek.com/updates">API Change Log</a> → api-changelog.md</li>
        <li><a href="https://api-docs.deepseek.com/news">API News</a> → NEWS.md</li>
        <li><a href="https://www.deepseek.com/en/news/">deepseek.com Blog</a> → website-news.md</li>
        <li><a href="https://github.com/deepseek-ai">deepseek-ai Releases</a> → releases.md</li>
        <li><a href="https://huggingface.co/deepseek-ai">HuggingFace</a> → huggingface.md</li>
        <li><a href="https://www.npmjs.com/package/@deepseek-ai/dsh">npm dsh</a> → npm.md</li>
      </ul>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>⚙️ Automation</h2>
      <p style="font-size:13px">Track: <code>0 */6 * * *</code> + <code>pull --rebase --autostash</code> retry x3<br/>Discover: <code>30 3 * * *</code> headless <code>opencode run</code> with latest free models → PR</p>
      <p style="font-size:13px"><a href="https://github.com/awesome-deepseekharness/deepseek-official-tracker/actions">Actions →</a></p>
    </div>
  </div>
</div>
<footer>
  <div class="wrap">
    <p>© DeepSeek Official Tracker · <a href="https://github.com/awesome-deepseekharness/deepseek-official-tracker/blob/main/LICENSE">CC0-1.0</a> · Data belongs to respective owners · Built with ❤️ for DeepSeek community</p>
    <p>Keywords: deepseek deepseek api deepseek v4 deepseek v3.2 deepseek r1 deepseek harness dsh</p>
  </div>
</footer>
</body>
</html>`;

  fs.writeFileSync(path.join(SITE_DIR, 'index.html'), html, 'utf8');
  fs.writeFileSync(path.join(SITE_DIR, 'feed.json'), JSON.stringify({ generatedAt: now, count: feedItems.length, items: feedItems }, null, 2), 'utf8');
  // Copy raw markdown for direct access if needed
  for (const f of ['FEED.md', 'NEWS.md', 'website-news.md', 'huggingface.md', 'insights.md']) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(SITE_DIR, f));
  }
  console.log(`[build-pages] site built at ${SITE_DIR} with ${feedItems.length} items`);
}

build();
