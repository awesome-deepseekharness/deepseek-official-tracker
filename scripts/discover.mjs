#!/usr/bin/env node
/**
 * discover.mjs — experimental AI agent discovery for DeepSeek official updates
 *
 * - Collects live signals from 12 independent corners via scripts/corners.mjs
 *   (blog, changelog, GitHub releases/tags/repos, HF, npm, arXiv, HN, Reddit,
 *   Google News, PyPI, OpenRouter) — all key-free
 * - Diffs them against data/discover-seen.json (written only by this script, so
 *   track.mjs cannot mask new signals the way data/state.json used to)
 * - Fetches live free models from https://opencode.ai/zen/v1/models
 * - Tries each free model via `opencode run --model opencode/<id>` with fallback
 * - Always succeeds: if opencode unavailable or all models fail, falls back to deterministic template
 * - Writes insights.md (AI-generated draft, needs human review via PR)
 *
 * Usage: node scripts/discover.mjs [--force] [--dry-run]
 *   --force   run even when no fresh signals (same as DISCOVER_FORCE=1)
 *   --dry-run stop after gate + prompt, do not invoke an LLM or write files
 * Requires: OPENCODE_API_KEY (optional, for Zen free models) / GITHUB_TOKEN for rate limits
 * Output: insights.md + data/discover-seen.json at repo root
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { collectSignals, loadSeen, saveSeen } from './corners.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'state.json');
const INSIGHTS_FILE = path.join(ROOT, 'insights.md');
const FEED_FILE = path.join(ROOT, 'FEED.md');
const ZEN_MODELS_URL = 'https://opencode.ai/zen/v1/models';

// Fallback static free models if Zen endpoint fails (keep in sync with docs)
const STATIC_FREE_FALLBACK = [
  'deepseek-v4-flash-free',
  'muse-spark-1.2-contributor-free',
  'mimo-v2.5-free',
  'hy3-free',
  'nemotron-3-ultra-free',
  'nemotron-3.5-lightning-free',
  'laguna-s-2.1-free',
  'big-pickle',
  'north-mini-code-free',
  'grok-build-0.1', // sometimes free in rotation
];

async function fetchText(url, opts = {}) {
  const headers = { 'User-Agent': 'deepseek-official-tracker-discover/1.0', ...(opts.headers || {}) };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

async function fetchLiveFreeModels() {
  // Always try live Zen endpoint first for "latest" free models
  try {
    const raw = await fetchText(ZEN_MODELS_URL, { timeoutMs: 8000 });
    const data = JSON.parse(raw);
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    // Filter free: id contains -free or name contains free, or pricing free if present
    const free = list
      .filter(m => {
        const id = (m.id || '').toLowerCase();
        const name = (m.name || '').toLowerCase();
        if (id.includes('-free') || name.includes(' free')) return true;
        // pricing heuristic if present
        if (m.pricing && m.pricing.input === 0 && m.pricing.output === 0) return true;
        return false;
      })
      .map(m => m.id)
      .filter(Boolean);
    if (free.length) {
      // Deduplicate, keep order as returned (API is roughly latest first), but prioritize deepseek-v4-flash-free for this repo
      const uniq = [...new Set(free)];
      // Move deepseek free to front if present
      uniq.sort((a, b) => {
        if (a === 'deepseek-v4-flash-free') return -1;
        if (b === 'deepseek-v4-flash-free') return 1;
        return 0;
      });
      console.log(`Live free models from Zen: ${uniq.join(', ')}`);
      return uniq;
    }
  } catch (e) {
    console.warn(`Zen models fetch failed, using static fallback: ${e.message}`);
  }
  console.log(`Using static free fallback: ${STATIC_FREE_FALLBACK.slice(0, 7).join(', ')}`);
  return STATIC_FREE_FALLBACK;
}

function runOpencode(modelId, prompt) {
  return new Promise((resolve, reject) => {
    const model = `opencode/${modelId}`;
    const args = ['run', '--model', model, '--agent', 'discover', '--thinking', prompt];
    console.log(`\n[discover] Trying model: ${model} (agent:discover, thinking) ...`);
    const isWin = process.platform === 'win32';
    const child = spawn('opencode', args, {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin, // win32 needs shell for opencode.ps1
    });
    let out = '', err = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`opencode timeout for ${model}`));
    }, 300000); // 5min per model — deep research needs longer reasoning
    child.stdout.on('data', d => { out += d.toString(); process.stdout.write(d); });
    child.stderr.on('data', d => { err += d.toString(); process.stderr.write(d); });
    child.on('error', e => {
      clearTimeout(timeout);
      reject(e);
    });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolve({ code, out, err });
      else reject(new Error(`opencode ${model} exit ${code}: ${err.slice(0, 500)}`));
    });
  });
}

async function generateWithTraversal(prompt) {
  const freeModels = await fetchLiveFreeModels();
  // Ensure we try latest first, but also keep static fallback order as last resort
  const combined = [...new Set([...freeModels, ...STATIC_FREE_FALLBACK])];
  let lastErr = null;
  for (const modelId of combined) {
    try {
      // Check if opencode binary exists (win32 needs shell for .ps1)
      const isWin = process.platform === 'win32';
      const hasOpencode = await new Promise(res => {
        const c = spawn('opencode', ['--version'], { stdio: 'ignore', shell: isWin });
        c.on('error', () => res(false));
        c.on('close', code => res(code === 0));
      });
      if (!hasOpencode) throw new Error('opencode binary not found (fallback to template)');
      await runOpencode(modelId, prompt);
      // Verify insights.md was created and contains sources
      if (fs.existsSync(INSIGHTS_FILE)) {
        const content = fs.readFileSync(INSIGHTS_FILE, 'utf8');
        if (content.includes('[Source]') || content.includes('http')) {
          console.log(`[discover] Success with model ${modelId}, insights.md updated`);
          return { modelId, success: true };
        } else {
          console.warn(`[discover] Model ${modelId} produced insights.md without sources, trying next`);
          lastErr = new Error('no sources in insights');
          continue;
        }
      } else {
        console.warn(`[discover] Model ${modelId} did not create insights.md, trying next`);
        lastErr = new Error('no insights.md');
        continue;
      }
    } catch (e) {
      console.warn(`[discover] Model ${modelId} failed: ${e.message}`);
      lastErr = e;
      await sleep(1200);
      continue;
    }
  }
  throw lastErr || new Error('all free models failed');
}

function buildPrompt({ newSlugs, state, feedPreview, fresh = [], cornerErrors = [] }) {
  const now = new Date().toISOString();
  const byTier = fresh.reduce((acc, s) => {
    (acc[s.tier] ||= []).push(s);
    return acc;
  }, {});
  const fmtList = (list, cap = 22) =>
    list.slice(0, cap).map(s => `  - [${s.source}] ${s.date || 'date-unknown'} — ${s.title}${s.detail ? ` — ${s.detail}` : ''}\n    ${s.url}`).join('\n');
  return [
    `You are the DeepSeek Deep Discovery Agent (see .opencode/agent/discover.md). You are *autonomous, thorough, multi-source, max reasoning (xhigh thinking)*. This is a 25-minute deep dive — NOT a 2-minute quick check. Use your time fully. Exhaust tools before writing.`,
    ``,
    `## Context (as of ${now} UTC)`,
    `- Repo: https://github.com/awesome-deepseekharness/deepseek-official-tracker`,
    `- Known state (data/state.json) websiteNews: ${JSON.stringify(state.websiteNews || []).slice(0, 600)}`,
    `- changelog/news/huggingface (last 5): ${JSON.stringify({ changelog: (state.changelog||[]).slice(-5), news: (state.news||[]).slice(-5), huggingface: (state.huggingface||[]).slice(-5) }).slice(0, 800)}`,
    `- releases (last 5): ${JSON.stringify((state.releases||[]).slice(-5)).slice(0, 600)}`,
    `- Precomputed diff on https://www.deepseek.com/en/news/ vs state: ${newSlugs.length ? newSlugs.join(', ') : '(none — but do NOT trust this alone, you must re-verify live with tools)'}`,
    ``,
    `## PRECOMPUTED LIVE SIGNALS — ${fresh.length} fresh across ${Object.keys(byTier).length} tiers`,
    `These were collected just now by scripts/corners.mjs from ${fresh.length ? 'independent live endpoints' : 'live endpoints'} and diffed against data/discover-seen.json (which only this script writes). Treat them as a worklist of LEADS: verify each with a fetch before calling it real, dedup against the repo files, and drop anything already tracked. Do NOT just restate this list — it is your starting point, not your output.`,
    ...(fresh.length ? [
      ``,
      `### OFFICIAL first-party (${(byTier.official || []).length}) — verify date+title, these are the ones that count`,
      fmtList(byTier.official || []),
      ``,
      `### SECONDARY authoritative (${(byTier.secondary || []).length}) — corroboration, not primary`,
      fmtList(byTier.secondary || []),
      ``,
      `### COMMUNITY unverified (${(byTier.community || []).length}) — early signals only, label unverified`,
      fmtList(byTier.community || []),
    ] : [`- (none fresh this run — that is why you were triggered; go find what the precomputed corners missed, use websearch/browser aggressively)`]),
    ...(cornerErrors.length ? [
      ``,
      `### CORNERS THAT FAILED THIS RUN — probe these yourself with tools and say so`,
      ...cornerErrors.map(e => `  - ${e}`),
    ] : []),
    ``,
    `- FEED preview (newest 22):`,
    ...feedPreview.split('\n').slice(0, 22).map(l => `  ${l}`),
    ``,
    `## Your toolbox — prioritise the key-free endpoints that actually work, then escalate to browser/websearch`,
    `NOTE: s.jina.ai now returns 401 (key-gated) and Reddit JSON often 403/429. Do not burn your budget retrying them — go straight to the alternatives below, and only fall back to jina/websearch if listed ones fail.`,
    `- read / grep / glob : inspect repo (FEED.md, state.json, website-news.md, api-changelog.md, releases.md, npm.md, huggingface.md, discover-seen.json) — start here to dedup`,
    `- bash + curl : the workhorse. All of these are key-free and verified working — use at least 8:`,
    `  • Blog + API: \`curl -s https://www.deepseek.com/en/news/\` | \`curl -s https://api-docs.deepseek.com/updates\``,
    `  • GitHub releases (the harness releases come from HERE, not the blog — check it every run): \`curl -s "https://api.github.com/repos/deepseek-ai/deepseek-harness/releases?per_page=5" | jq '.[] | {tag_name, published_at, body}'\``,
    `  • GitHub org activity (catches brand-new repos + new releases the 28-repo allowlist misses): \`curl -s "https://api.github.com/orgs/deepseek-ai/repos?per_page=100&sort=pushed" | jq -r '.[] | select(.pushed_at > "'"$(date -u -d '14 days ago' +%Y-%m-%d)"'") | "\(.full_name) \(.pushed_at) ★\(.stargazers_count)"'\``,
    `  • GitHub discussions (where devs announce things first): \`curl -s "https://api.github.com/repos/deepseek-ai/deepseek-harness/discussions?per_page=5" | jq\``,
    `  • HuggingFace: \`curl -s "https://huggingface.co/api/models?author=deepseek-ai&sort=lastModified&limit=15" | jq -r '.[] | "\(.lastModified[0:10]) \(.modelId)"'\` + \`curl -s "https://huggingface.co/api/daily_papers?limit=10" | jq -r '.[].title'\``,
    `  • npm: \`curl -s https://registry.npmjs.org/@deepseek-ai/dsh | jq '.["dist-tags"]'\` + \`curl -s "https://registry.npmjs.org/-/v1/search?text=%40deepseek-ai&size=20" | jq -r '.objects[].package | "\(.date[0:10]) \(.name)@\(.version)"'\``,
    `  • arXiv (rate-limited — sleep 3s between calls, retry on 429): \`curl -s "https://export.arxiv.org/api/query?search_query=ti:%22DeepSeek%22&sortBy=submittedDate&max_results=10"\``,
    `  • HackerNews: \`curl -s "https://hn.algolia.com/api/v1/search?query=deepseek&tags=story&hitsPerPage=15" | jq -r '.hits[] | "\(.created_at[0:10]) \(.points)p \(.title)"'\``,
    `  • Google News RSS (broad media sweep, key-free): \`curl -s "https://news.google.com/rss/search?q=deepseek&hl=en-US&gl=US&ceid=US:en" | grep -o '<title>[^<]*' | head -30\``,
    `  • OpenRouter (catches new model IDs served by aggregators before DeepSeek blogs): \`curl -s https://openrouter.ai/api/v1/models | jq -r '.data[] | select(.id | test("deepseek";"i")) | .id'\``,
    `  • PyPI: \`curl -s https://pypi.org/pypi/deepseek/json | jq '.info.version'\``,
    `  • Chinese press via websearch: "deepseek 官方 发布" / "深度求索 新模型" — WeChat/Weibo/36kr/机器之心 relays often break first`,
    `- websearch : use for gaps the endpoints miss (WeChat, Weibo, Discord, Chinese media). 4-6 searches minimum.`,
    `- webfetch : static HTML fetch`,
    `- Remote browser (kitesurf MCP, rendered): use for JS-heavy pages — x.com/deepseek_ai timeline, huggingface.co/deepseek-ai trending. Top 2 high-value targets only; compare with a curl result before trusting.`,
    `- edit : write insights.md  |  todowrite / task : plan your 4 phases`,
    ``,
    `## Deep discovery methodology — 4 phases (MANDATORY, use todowrite to track)`,
    `### Phase 1 — Ground truth (30% time, must do first)`,
    `- Work the PRECOMPUTED SIGNALS list above. For each OFFICIAL lead: fetch it live, confirm title + date + that it is real, and grep the repo to check whether it is already tracked.`,
    `- GitHub harness releases are first-class news — check \`deepseek-ai/deepseek-harness\` releases AND the org repo list every run, even if the blog shows nothing new.`,
    `- Record which items are *new vs already tracked*.`,
    ``,
    `### Phase 2 — Secondary authoritative (30% time, this is NEW — go beyond blog)`,
    `- arXiv recent DeepSeek papers (export.arxiv API) — any new V4/V3/R1 paper in last 14 days?`,
    `- HuggingFace trending: are new deepseek-ai models trending vs state.json?`,
    `- GitHub trending / search: any new deepseek-ai repo or major release not in state?`,
    `- npm: any new @deepseek-ai package version?`,
    `- Tech media websearch: fetch 2-3 articles about DeepSeek from past 14 days, cross-check if they reference an official release you missed.`,
    `- Label these as "secondary" — authoritative but not official blog. Cross-verify: if media says "DeepSeek released X", find the official [Source] (deepseek.com / github / huggingface) before calling verified.`,
    ``,
    `### Phase 3 — Community & market early signals (30% time, detect before official posts)`,
    `- X: websearch + jina timeline of @deepseek_ai — look for teasers, retweets, AMA.`,
    `- Reddit: both r/LocalLLaMA and r/deepseek JSON — rising threads about DeepSeek in past 7 days?`,
    `- HN Algolia: top DeepSeek stories past 30 days — any front-page that hints at unannounced drop?`,
    `- WeChat/Discord via websearch: "deepseek 微信" / "deepseek discord" — capture signals.`,
    `- Treat ALL of this as *unverified signals* — a finding is only "verified" if official primary Source exists. Otherwise mark "unverified community signal — pending official confirmation" with signal [Source] + note "need official [Source]".`,
    ``,
    `### Phase 4 — Synthesis & cross-check (10% time)`,
    `- Grep FEED.md / website-news.md / api-changelog.md / NEWS.md / huggingface.md / releases.md for each candidate title/slug — deduplicate.`,
    `- Decide: is there truly a new official update? Or only community buzz? Be conservative — hallucination is worse than omission.`,
    `- Then write insights.md.`,
    ``,
    `## Output — overwrite insights.md (thinking:max, variant:max, 900-1300 words)`,
    `- Language: English primary, Chinese summary 1 sentence optional at end of Summary`,
    `- IMPORTANT: Do NOT write a ## Thinking section to insights.md. Your internal reasoning is via --thinking (streams to Action logs); insights.md must start directly with ## Summary after the header.`,
    `- Structure (follow exactly, keep headers):`,
    `  1. # Insights — DeepSeek Deep Discovery — <YYYY-MM-DD>`,
    `  2. > Auto-generated by opencode (model: <model-id>, reasoning:xhigh, thinking) — <ISO> UTC. Deep research (4-phase, multi-source). AI draft, needs human review via PR.`,
    `  3. ## Summary — 3-4 sentences, high level + trend`,
    `  4. ## New findings (verified) — for each *verified official* item: **title** — date — 1-2 sentence why it matters — [Source](official url). Group by type (Blog / API / GitHub / HF / npm). If none, write "No new verified official updates after full 4-phase check — <timestamp> UTC" but still show you did the work.`,
    `  5. ## Secondary signals — arXiv / HF papers / GitHub trending / tech media hits with [Source], labeled "secondary — authoritative, not official blog".`,
    `  6. ## Community signals — X / Reddit / HN hits with [Source], clearly labeled "unverified — pending official confirmation". Even if no official update, always try to fill this from Phase 3.`,
    `  7. ## Trends & Context — connect to prior FEED: cadence, e.g., "V4-Flash-Vision-Exp (08-21) follows V4-Pro 0813 by 8 days — multimodal push continues".`,
    `  8. ## Cross-check — table/bullets vs website-news.md / api-changelog.md / NEWS.md / huggingface.md / releases.md / data/state.json — note "already tracked" vs "new".`,
    `  9. ## Risk / Confidence — low/medium/high + justification + what to manually verify.`,
    `  10. ## Next steps — suggest \`node scripts/track.mjs\` if new, else "wait for next 6h cron".`,
    `  11. ## FEED preview — first 20 lines of FEED.md (code fence)`,
    `  12. ## Appendix — Sources fetched — bullet list of every URL you actually fetched with tool tag [jina]/[browser]/[api]/[websearch] for audit (12+ bullets, at least 2 browser).`,
    `- If you did 10+ tool calls, your Appendix will prove it. A thin Appendix = incomplete job.`,
    `- NEVER invent slug/date/title. If uncertain, write "unverified" and ask for manual webfetch.`,
    `- Prefer jina.ai when webfetch returns Next.js shell or 403.`,
    ``,
    `## Guardrails`,
    `- PR-safe: draft only, never push to main — your file goes via PR.`,
    `- Exhaust before writing: workflow gave you 30 min, use at least 8-12 min research. Do not write after 2 fetches.`,
    `- Evidence > speed: 3 well-sourced findings beat 10 unsourced.`,
    `- You run on free model via public opencode Zen — do your best, but be honest about limits.`,
    ``,
    `Proceed: todowrite Phase 1→4, then execute. After writing insights.md, echo "DONE" and list all [Source] URLs you fetched.`,
  ].join('\n');
}

function buildDeterministicInsights({ newSlugs, state, fresh = [] }) {
  const now = new Date().toISOString();
  const feed = fs.existsSync(FEED_FILE) ? fs.readFileSync(FEED_FILE, 'utf8').split('\n').slice(0, 25).join('\n') : '(no FEED)';
  const hasNew = newSlugs.length > 0;
  const official = fresh.filter(s => s.tier === 'official');
  const other = fresh.filter(s => s.tier !== 'official');
  return `# Insights — DeepSeek Official Discovery — ${now.slice(0, 10)}

> Auto-generated by discover.mjs (deterministic fallback, no LLM). This is a draft for PR review — opencode free models unavailable or no OPENCODE_API_KEY.

## Summary
${hasNew || official.length ? `Collected ${fresh.length} fresh live signal(s) across corners via scripts/corners.mjs, ${official.length} of them first-party. Needs AI summarization/verification.` : `No new deepseek.com diff detected vs state. The tracker appears up-to-date as of ${now} UTC.`}

## New findings
${official.length
    ? official.slice(0, 30).map(s => `- **${s.title}** — ${s.date || 'date-unknown'} — [${s.source}](${s.url})${s.detail ? ` — ${s.detail}` : ''}`).join('\n')
    : `- No new official items. Last known websiteNews: ${(state.websiteNews||[]).slice(-7).join(', ') || '(empty)'}`}

## Secondary / community signals (unverified)
${other.length
    ? other.slice(0, 25).map(s => `- ${s.title} — ${s.date || 'date-unknown'} — [${s.source}](${s.url})`).join('\n')
    : `- None captured.`}

## Cross-check
- Signals diffed against data/discover-seen.json (agent-owned) — see scripts/corners.mjs.
- api-changelog.md / NEWS.md / website-news.md / huggingface.md compared. See FEED preview below.

## Risk / Confidence
- Confidence: ${official.length ? 'medium — deterministic collection, but no LLM verification pass' : 'high — no diff'}
- Risk: low — fallback template, no hallucination.

## Next steps
- If new items verified, run \`node scripts/track.mjs\` (or wait for next 6h cron) to ingest.
- Reviewer: please fetch each [Source] and confirm title/date before merging.

## FEED preview
\`\`\`
${feed}
\`\`\`

---
*Generated by scripts/discover.mjs fallback at ${now} UTC. To enable AI summarization, set OPENCODE_API_KEY (https://opencode.ai/auth) in repo Secrets and re-run.*
`;
}

async function main() {
  console.log(`[discover] Deep discovery starting at ${new Date().toISOString()}`);
  const state = loadState();
  let feedPreview = '';
  try { feedPreview = fs.readFileSync(FEED_FILE, 'utf8').slice(0, 2500); } catch {}

  // Multi-corner live probe. Unlike the old blog-slug-only diff (which track.mjs
  // already consumed every 6h, so the gate was effectively always empty), this
  // covers blog + changelog + GitHub releases/tags/repos + HF + npm + arXiv + HN
  // + Reddit + Google News + PyPI + OpenRouter.
  let corners = { signals: [], errors: [] };
  try {
    corners = await collectSignals();
  } catch (e) {
    console.warn(`[discover] Corner collection failed: ${e.message}`);
  }
  const seen = loadSeen();
  const fresh = corners.signals.filter(s => !seen.ids.has(s.id));
  const newSlugs = fresh.filter(s => s.id.startsWith('blog:')).map(s => s.id.slice(5));
  console.log(`[discover] Corners: ${corners.signals.length} signals, ${corners.errors.length} errors, ${fresh.length} fresh vs ${seen.ids.size} seen`);
  if (corners.errors.length) console.warn(`[discover] Corner errors: ${corners.errors.join(' | ')}`);

  // Fresh-signal gate. Previously this compared live blog slugs against
  // data/state.json — but track.mjs writes that same file, so non-blog news
  // (harness releases, npm, HF) could never trip it and the agent almost never
  // ran. Now we diff against our own data/discover-seen.json, which only this
  // script writes, so anything genuinely unreported triggers a run.
  const force = process.argv.includes('--force') || process.env.DISCOVER_FORCE === 'true';
  const CORNER_FAILURE_MARGIN = 2;
  const cornerDegraded = corners.errors.length > CORNER_FAILURE_MARGIN;
  if (fresh.length === 0 && !force && !cornerDegraded) {
    console.log('[discover] No fresh signals vs data/discover-seen.json — skipping run (no PR noise).');
    return;
  }
  if (fresh.length === 0 && cornerDegraded) {
    console.warn('[discover] No fresh signals but corners are degraded — running anyway so gaps get reported.');
  }

  const prompt = buildPrompt({ newSlugs, state, feedPreview, fresh, cornerErrors: corners.errors });

  // Write prompt to temp file for debugging (optional)
  fs.writeFileSync(path.join(ROOT, '.discover-prompt.md'), prompt, 'utf8');
  console.log(`[discover] Prompt written to .discover-prompt.md (${prompt.length} chars)`);

  // --dry-run: stop after gate + prompt so the pipeline can be tested without
  // invoking an LLM. Never writes insights.md or the seen baseline.
  if (process.argv.includes('--dry-run')) {
    console.log('[discover] --dry-run: skipping agent traversal and seen-baseline write.');
    return;
  }

  // Always proceed to agentic run — even with no diff, agent will check community signals (X/Reddit/HN) via tools
  console.log(`[discover] Env check — OPENCODE_API_KEY:${process.env.OPENCODE_API_KEY ? 'yes('+process.env.OPENCODE_API_KEY.length+' chars)' : 'no'} ANTHROPIC:${process.env.ANTHROPIC_API_KEY ? 'yes' : 'no'} OPENAI:${process.env.OPENAI_API_KEY ? 'yes' : 'no'} — proceeding to agentic run regardless of diff`);
  // Note: PR spam is now handled by peter-evans/create-pull-request (branch not ahead → no PR), not by early return

  // Try opencode traversal if binary and key present (or even without key, try — free models may still work with dummy)
  const hasKey = !!process.env.OPENCODE_API_KEY || !!process.env.OPENCODE_API_KEY?.length || !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  console.log(`[discover] OPENCODE_API_KEY present: ${hasKey}, attempting opencode traversal...`);

  try {
    await generateWithTraversal(prompt);
    // Success — insights.md already written by agent
  } catch (e) {
    console.warn(`[discover] All opencode attempts failed (${e.message}), falling back to deterministic template`);
    const fallback = buildDeterministicInsights({ newSlugs, state, fresh });
    fs.writeFileSync(INSIGHTS_FILE, fallback, 'utf8');
    console.log(`[discover] Fallback insights.md written (${fallback.length} chars)`);
  }

  // Ensure insights.md exists and has required structure
  if (!fs.existsSync(INSIGHTS_FILE)) {
    const fallback = buildDeterministicInsights({ newSlugs, state, fresh });
    fs.writeFileSync(INSIGHTS_FILE, fallback, 'utf8');
  }
  const final = fs.readFileSync(INSIGHTS_FILE, 'utf8');
  console.log(`[discover] Done. insights.md preview:\n${final.slice(0, 800)}\n...`);

  // Mark these signals as reported so tomorrow's gate does not re-fire on them.
  // Only fold in signals we actually surfaced; on a corner failure we still
  // record the rest so one dead endpoint cannot cause a permanent stall.
  saveSeen([...seen.ids, ...fresh.map(s => s.id)], {
    lastRunAt: new Date().toISOString(),
    lastFreshCount: fresh.length,
    cornerErrors: corners.errors,
  });

  // Exit code 0 always (PR will be created only if file changed)
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
