#!/usr/bin/env node
/**
 * discover.mjs — experimental AI agent discovery for DeepSeek official updates
 *
 * - Collects live signals from multiple independent corners via scripts/corners.mjs
 *   (blog, changelog, GitHub releases/tags/repos, HF, npm, arXiv, HN, Reddit,
 *   Google News, PyPI, OpenRouter) — all key-free
 * - Diffs them against data/discover-seen.json (written only by this script, so
 *   track.mjs cannot mask new signals the way data/state.json used to)
 * - Refreshes and ranks zero-cost tool-capable models from the CLI registry
 * - Tries each free model via `opencode run --model opencode/<id>` with fallback
 * - Reports failure and preserves the previous report if every free model fails
 * - Writes insights.md (AI-generated draft, independently reviewed via PR)
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
import { collectSignals, loadSeen, saveSeen } from './corners.mjs';
import { probeBrowser } from './kitesurf-probe.mjs';
import { runAgent } from './opencode-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'state.json');
const INSIGHTS_FILE = path.join(ROOT, 'insights.md');
const FEED_FILE = path.join(ROOT, 'FEED.md');
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

async function generateWithTraversal(prompt) {
  const previous = fs.existsSync(INSIGHTS_FILE) ? fs.readFileSync(INSIGHTS_FILE, 'utf8') : '';
  const restore = () => fs.writeFileSync(INSIGHTS_FILE, previous, 'utf8');
  try {
    return await runAgent({
      agent: 'discover', prompt,
      timeoutMs: 360000, totalMs: 1200000,
      beforeAttempt: restore,
      validate: () => {
        const next = fs.readFileSync(INSIGHTS_FILE, 'utf8');
        return next !== previous && next.includes('[Source](') &&
          next.includes('## Summary') && next.includes('## Risk / Confidence');
      },
    });
  } catch (error) {
    restore();
    throw error;
  }
}

function buildPrompt({ newSlugs, state, feedPreview, fresh = [], cornerErrors = [], browserOk = null }) {
  const now = new Date().toISOString();
  const byTier = fresh.reduce((acc, s) => {
    (acc[s.tier] ||= []).push(s);
    return acc;
  }, {});
  const fmtList = (list, cap = 22) =>
    list.slice(0, cap).map(s => `  - [${s.source}] ${s.date || 'date-unknown'} — ${s.title}${s.detail ? ` — ${s.detail}` : ''}\n    ${s.url}`).join('\n');
  return [
    `You are the DeepSeek Deep Discovery Agent (see .opencode/agent/discover.md). You are *autonomous, thorough, multi-source, max reasoning (xhigh thinking)*. Use the bounded research window to verify material new claims and write a sourced report. Do not wait to satisfy a time quota.`,
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
      ...((byTier.rumor || []).length ? [
        ``,
        `### RUMOURS (${byTier.rumor.length}) — speculation about work DeepSeek has NOT announced. Report these in a dedicated \`## Rumours — 疑似 / unverified\` section with the claim date, the source, and what would confirm it. NEVER put a rumour in New findings, the README, or FEED — speculation is not a release.`,
        fmtList(byTier.rumor, 12),
      ] : []),
    ] : [`- (none fresh this run — that is why you were triggered; go find what the precomputed corners missed, use exa/firecrawl/browser aggressively)`]),
    ...(cornerErrors.length ? [
      ``,
      `### CORNERS THAT FAILED THIS RUN — probe these yourself with tools and say so`,
      ...cornerErrors.map(e => `  - ${e}`),
    ] : []),
    ``,
    `- FEED preview (newest 22):`,
    ...feedPreview.split('\n').slice(0, 22).map(l => `  ${l}`),
    ``,
    `## Your toolbox — prioritise the key-free channels that actually work, then escalate to browser/search`,
    `NOTE: s.jina.ai returns 401 (key-gated), Exa's REST api.exa.ai/search returns 402 (keyless is MCP-only), Reddit JSON often 403/429. Do not burn budget retrying them.`,
    `- **exa MCP (key-free, prefer over websearch):** \`web_search_exa\` for semantic+dated discovery, \`web_search_advanced_exa\` with \`startPublishedDate\`/\`includeDomains\` to time-box a sweep, \`web_fetch_exa\` to batch-read several URLs in one call.`,
    `- **firecrawl MCP (key-free):** \`firecrawl_search\` (add \`categories:["research"]\` for papers, \`["developer"]\` for GitHub issues/PRs) and \`firecrawl_scrape\` for JS-heavy pages.`,
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
    `  • Chinese press is already collected for you (google-news-zh + cn-tech-media + V2EX corners: 量子位 / InfoQ / Solidot / 国内媒体). Use exa only to go deeper: \`web_search_exa "deepseek 官方发布 新模型"\``,
    `- websearch : use for gaps the endpoints miss (WeChat, Weibo, Discord, Chinese media). 4-6 searches minimum.`,
    `- webfetch : static HTML fetch`,
    `- Remote browser (kitesurf MCP over wss://kitesurf.dev/devtools/browser, rendered, stateless, no key): use for JS-heavy pages — x.com/deepseek_ai timeline, huggingface.co/deepseek-ai trending. Top 2 high-value targets only; compare with a curl result before trusting.${browserOk === false ? ' **PROBE SAYS UNUSABLE THIS RUN — skip it, do not retry, and note the gap in Risk/Confidence.**' : ''}`,
    `- edit : write insights.md  |  todowrite / task : plan your 4 phases`,
    `- DEAD ENDS (verified, do not retry): s.jina.ai → 401 · api.exa.ai/search REST → 402 (use exa MCP) · jiqizhixin.com/rss/articles → 404 · 36kr.com/feed → empty · lobste.rs/search.json → 400`,
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
    `  2. > Auto-generated by opencode (model: <model-id>, independently reviewed research) — <ISO> UTC. Deep research (4-phase, multi-source). AI draft, independently reviewed via PR.`,
    `  3. ## Summary — 3-4 sentences, high level + trend`,
    `  4. ## New findings (verified) — for each *verified official* item: **title** — date — 1-2 sentence why it matters — [Source](official url). Group by type (Blog / API / GitHub / HF / npm). If none, write "No new verified official updates after full 4-phase check — <timestamp> UTC" but still show you did the work.`,
    `  5. ## Secondary signals — arXiv / HF papers / GitHub trending / tech media hits with [Source], labeled "secondary — authoritative, not official blog".`,
    `  6. ## Community signals — X / Reddit / HN / V2EX / GitHub-community hits with [Source], clearly labeled "unverified — pending official confirmation". Even if no official update, always try to fill this from Phase 3.`,
    `  6b. ## Rumours — 疑似 / unverified — forward-looking claims about UNANNOUNCED work, from the RUMOURS tier. Every bullet must carry 疑似/unverified inline, give the claim date + [Source], and state what would confirm it. Say whether each is confirmed, disproved, or still open. If there are none, write "No active rumours in the last 21 days." — never invent one to fill the section, and never promote a rumour into New findings.`,
    `  7. ## Trends & Context — connect to prior FEED: cadence, e.g., "V4-Flash-Vision-Exp (08-21) follows V4-Pro 0813 by 8 days — multimodal push continues".`,
    `  8. ## Cross-check — table/bullets vs website-news.md / api-changelog.md / NEWS.md / huggingface.md / releases.md / data/state.json — note "already tracked" vs "new".`,
    `  9. ## Risk / Confidence — low/medium/high + justification + what to manually verify.`,
    `  10. ## Next steps — suggest \`node scripts/track.mjs\` if new, else "wait for next 6h cron".`,
    `  11. ## FEED preview — first 20 lines of FEED.md (code fence)`,
    `  12. ## Appendix — Sources fetched — bullet list of every URL you actually fetched with tool tag [exa]/[firecrawl]/[browser]/[api]/[curl] for audit (12+ bullets, at least 2 via exa or firecrawl).`,
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
  const force = process.argv.includes('--force') || process.env.DISCOVER_FORCE === 'true' || process.env.DISCOVER_FORCE === '1';
  const CORNER_FAILURE_MARGIN = 2;
  const cornerDegraded = corners.errors.length > CORNER_FAILURE_MARGIN;
  if (fresh.length === 0 && !force && !cornerDegraded) {
    console.log('[discover] No fresh signals vs data/discover-seen.json — skipping run (no PR noise).');
    return;
  }
  if (fresh.length === 0 && cornerDegraded) {
    console.warn('[discover] No fresh signals but corners are degraded — running anyway so gaps get reported.');
  }

  // The remote browser is experimental and its endpoint already moved hosts
  // once, breaking it silently: the old host completed TCP and TLS but failed
  // every CDP call, so the agent kept being told to use a dead tool. One
  // handshake per run turns that into a stated fact in the prompt.
  const browser = await probeBrowser();
  console.log(`[discover] Browser ${browser.ok ? `usable (${browser.targets} targets)` : `UNUSABLE: ${browser.error}`}`);

  const prompt = buildPrompt({
    newSlugs, state, feedPreview, fresh,
    cornerErrors: corners.errors,
    browserOk: browser.ok,
  });

  // Write prompt to temp file for debugging (optional)
  fs.writeFileSync(path.join(ROOT, '.discover-prompt.md'), prompt, 'utf8');
  console.log(`[discover] Prompt written to .discover-prompt.md (${prompt.length} chars)`);

  // --dry-run: stop after gate + prompt so the pipeline can be tested without
  // invoking an LLM. Never writes insights.md or the seen baseline.
  if (process.argv.includes('--dry-run')) {
    console.log('[discover] --dry-run: skipping agent traversal and seen-baseline write.');
    return;
  }

  // Preserve the last published report on model failure. A failed run must not
  // mark its inputs as researched or replace useful reporting with a template.
  await generateWithTraversal(prompt);
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

  // A changed, sourced report is required before the run can succeed.
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
