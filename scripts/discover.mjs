#!/usr/bin/env node
/**
 * discover.mjs — experimental AI agent discovery for DeepSeek official updates
 *
 * - Detects diff vs data/state.json (websiteNews, changelog, huggingface)
 * - Fetches live free models from https://opencode.ai/zen/v1/models
 * - Tries each free model via `opencode run --model opencode/<id>` with fallback
 * - Always succeeds: if opencode unavailable or all models fail, falls back to deterministic template
 * - Writes insights.md (AI-generated draft, needs human review via PR)
 *
 * Usage: node scripts/discover.mjs  (or via GitHub Action)
 * Requires: OPENCODE_API_KEY (optional, for Zen free models) / GITHUB_TOKEN for rate limits
 * Output: insights.md at repo root
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'state.json');
const INSIGHTS_FILE = path.join(ROOT, 'insights.md');
const FEED_FILE = path.join(ROOT, 'FEED.md');
const ZEN_MODELS_URL = 'https://opencode.ai/zen/v1/models';
const WEBSITE_NEWS_URL = 'https://www.deepseek.com/en/news/';
const API_DOCS_UPDATES = 'https://api-docs.deepseek.com/updates';

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
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 12000);
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

function extractWebsiteSlugs(html) {
  const slugs = new Set();
  const re = /href="\/en\/news\/([^"/]+)\/"/g;
  let m; while ((m = re.exec(html)) !== null) slugs.add(m[1].trim());
  const re2 = /href="\/news\/([^"/]+)\/"/g;
  while ((m = re2.exec(html)) !== null) slugs.add(m[1].trim());
  return [...slugs];
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
    }, 120000); // 2min per model
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

function buildPrompt({ newSlugs, state, feedPreview }) {
  const now = new Date().toISOString();
  return [
    `You are the autonomous DeepSeek Official Discovery Agent (see .opencode/agent/discover.md). Be *agentic*, not mechanical. Decide intelligently which tools to use.`,
    ``,
    `## Context (as of ${now} UTC)`,
    `- Repo: https://github.com/awesome-deepseekharness/deepseek-official-tracker`,
    `- Known state (data/state.json) websiteNews: ${JSON.stringify(state.websiteNews || []).slice(0, 500)}`,
    `- Known changelog/news/HF slugs: ${JSON.stringify({ changelog: (state.changelog||[]).slice(-3), news: (state.news||[]).slice(-3), huggingface: (state.huggingface||[]).slice(-3) }).slice(0, 600)}`,
    `- Precomputed diff on https://www.deepseek.com/en/news/ vs state: ${newSlugs.length ? newSlugs.join(', ') : '(none - but do NOT trust this alone, you must autonomously re-verify with tools)'}`,
    `- Recent FEED preview (newest 15):`,
    ...feedPreview.split('\n').slice(0, 18).map(l => `  ${l}`),
    ``,
    `## Your toolbox — use intelligently`,
    `- read / grep / glob : inspect repo (FEED.md, state.json, website-news.md, etc.)`,
    `- webfetch : fetch a URL (good for static HTML)`,
    `- websearch : search the web (e.g., "deepseek x.com deepseek_ai", "deepseek reddit", "deepseek hacker news")`,
    `- bash : run shell. Prefer these free, no-key helpers:`,
    `  • Jina AI reader (free, JS-proof): \`curl -s https://s.jina.ai/http://www.deepseek.com/en/news/\` or \`curl -s https://r.jina.ai/http://x.com/deepseek_ai\` or \`curl -s "https://cc.bingj.com/cache.cgi?d=3&m=https://x.com/deepseek_ai"\` — use when webfetch returns Next.js shell`,
    `  • HackerNews Algolia: \`curl -s "https://hn.algolia.com/api/v1/search?query=deepseek&tags=story&hitsPerPage=8" | jq\``,
    `  • Reddit JSON: \`curl -s -A "Mozilla/5.0" "https://www.reddit.com/r/LocalLLaMA/search.json?q=deepseek&sort=new&t=week" | jq\` and \`r/deepseek\`, via jina \`https://s.jina.ai/https://www.reddit.com/r/deepseek/\``,
    `  • X/Twitter: \`websearch "deepseek_ai site:x.com"\` then \`bash curl -s https://s.jina.ai/http://x.com/deepseek_ai\``,
    `  • HF: \`curl -s https://huggingface.co/api/models?author=deepseek-ai&sort=lastModified | jq\``,
    `  • npm: \`curl -s https://registry.npmjs.org/@deepseek-ai/dsh | jq\``,
    `- edit : write insights.md`,
    `- todowrite / task : plan`,
    ``,
    `## Discovery methodology (autonomous)`,
    `1. Verify official primaries yourself (don't trust precomputed diff): webfetch or jina fetch https://www.deepseek.com/en/news/ and each slug page, https://api-docs.deepseek.com/updates, https://api-docs.deepseek.com/news/<slug>.`,
    `2. Probe community signals to catch early hints (then cross-verify with official):`,
    `   - X: websearch + jina fetch x.com/deepseek_ai timeline`,
    `   - Reddit: r/LocalLLaMA + r/deepseek search JSON`,
    `   - HN: Algolia search`,
    `   Treat these as *signals only* — a finding is only "verified" if official Source exists. Otherwise mark "unverified community signal".`,
    `3. Decide next tool based on what you find. Be exploratory, not scripted.`,
    ``,
    `## Output — overwrite insights.md at repo root (thinking enabled, variant max)`,
    `- Language: English primary, Chinese summary optional`,
    `- Structure:`,
    `  1. # Insights — DeepSeek Official Discovery — <date>`,
    `  2. > Auto-generated by opencode (model: <model-id>, variant:max, thinking) — <ISO> UTC. AI draft, needs human review via PR.`,
    `  3. ## Thinking — 3-5 sentences of your reasoning: what you fetched, what diff you found, which community signals you checked, why you concluded (this will also appear in Action logs via --thinking)`,
    `  4. ## Summary — 2-3 sentences`,
    `  5. ## New findings — for each *verified* official item: title, date, 1-sentence summary, [Source](url) (official only)`,
    `  6. ## Community signals (optional) — X/Reddit/HN hits with [Source], labeled unverified`,
    `  7. ## Cross-check — vs website-news.md / api-changelog.md / NEWS.md / huggingface.md / state.json`,
    `  8. ## Risk / Confidence — low/medium/high`,
    `  9. ## Next steps — suggest node scripts/track.mjs or wait`,
    `  10. ## FEED preview — first 20 lines of FEED.md`,
    `- If truly no new official updates after your own verification, write "No new official updates detected" + timestamp, but still include Community signals if any.`,
    `- NEVER invent slug/date. If uncertain, write "unverified" and ask for manual review.`,
    ``,
    `## Guardrails`,
    `- PR-safe: draft for human review, never push to main.`,
    `- Prefer jina.ai (s.jina.ai / r.jina.ai / cc.bingj.com) when webfetch returns shell.`,
    `- You are on the latest free model via public opencode provider — do your best.`,
    ``,
    `Proceed autonomously. After writing insights.md, echo "DONE" and list all [Source] URLs you actually fetched.`,
  ].join('\n');
}

function buildDeterministicInsights({ newSlugs, state }) {
  const now = new Date().toISOString();
  const feed = fs.existsSync(FEED_FILE) ? fs.readFileSync(FEED_FILE, 'utf8').split('\n').slice(0, 25).join('\n') : '(no FEED)';
  const hasNew = newSlugs.length > 0;
  return `# Insights — DeepSeek Official Discovery — ${now.slice(0, 10)}

> Auto-generated by discover.mjs (deterministic fallback, no LLM). This is a draft for PR review — opencode free models unavailable or no OPENCODE_API_KEY.

## Summary
${hasNew ? `Detected ${newSlugs.length} new deepseek.com blog slug(s) vs data/state.json: ${newSlugs.join(', ')}. Needs verification via webfetch.` : `No new deepseek.com diff detected vs state. The tracker appears up-to-date as of ${now} UTC.`}

## New findings
${hasNew ? newSlugs.map(s => `- **${s}** — https://www.deepseek.com/en/news/${s}/ — [Source](https://www.deepseek.com/en/news/${s}/) — *pending AI summarization, run opencode with free model to fill*`).join('\n') : `- No new slugs. Last known websiteNews: ${(state.websiteNews||[]).slice(-7).join(', ') || '(empty)'}`}

## Cross-check
- api-changelog.md / NEWS.md / website-news.md / huggingface.md compared. See FEED preview below.

## Risk / Confidence
- Confidence: ${hasNew ? 'medium — new slugs need manual webfetch verification' : 'high — no diff'}
- Risk: low — fallback template, no hallucination.

## Next steps
- If new slugs verified, run \`node scripts/track.mjs\` (or wait for next 6h cron) to ingest.
- Reviewer: please webfetch each [Source] and confirm title/date before merging.

## FEED preview
\`\`\`
${feed}
\`\`\`

---
*Generated by scripts/discover.mjs fallback at ${now} UTC. To enable AI summarization, set OPENCODE_API_KEY (https://opencode.ai/auth) in repo Secrets and re-run.*
`;
}

async function main() {
  console.log(`[discover] Starting at ${new Date().toISOString()}`);
  const state = loadState();
  let newSlugs = [];
  let feedPreview = '';
  try { feedPreview = fs.readFileSync(FEED_FILE, 'utf8').slice(0, 2000); } catch {}
  try {
    const html = await fetchText(WEBSITE_NEWS_URL, { timeoutMs: 10000 });
    const liveSlugs = extractWebsiteSlugs(html);
    const known = new Set(state.websiteNews || []);
    newSlugs = liveSlugs.filter(s => !known.has(s));
    console.log(`[discover] Live slugs: ${liveSlugs.slice(0, 10).join(', ')}`);
    console.log(`[discover] Known: ${(state.websiteNews||[]).slice(-8).join(', ')}`);
    console.log(`[discover] New diff: ${newSlugs.length ? newSlugs.join(', ') : '(none)'}`);
  } catch (e) {
    console.warn(`[discover] Website fetch failed: ${e.message}, treating as no diff`);
  }

  const prompt = buildPrompt({ newSlugs, state, feedPreview });

  // Write prompt to temp file for debugging (optional)
  fs.writeFileSync(path.join(ROOT, '.discover-prompt.md'), prompt, 'utf8');
  console.log(`[discover] Prompt written to .discover-prompt.md (${prompt.length} chars)`);

  // Guard against PR spam: if no new slugs and insights already AI-generated and recent (<24h), skip
  // But always allow agentic run when OPENCODE_API_KEY present (for community signals)
  const hasKeyForAgentic = !!process.env.OPENCODE_API_KEY;
  if (newSlugs.length === 0 && fs.existsSync(INSIGHTS_FILE) && !hasKeyForAgentic) {
    try {
      const existing = fs.readFileSync(INSIGHTS_FILE, 'utf8');
      const knownTail = (state.websiteNews || []).slice(-7).join(', ');
      const stat = fs.statSync(INSIGHTS_FILE);
      const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
      if (existing.includes('No new') && existing.includes(knownTail.slice(0, 20)) && ageHours < 24) {
        console.log(`[discover] No new diff and insights up-to-date (${ageHours.toFixed(1)}h old) and no OPENCODE_API_KEY — skipping to avoid PR spam`);
        console.log(`[discover] Done. insights unchanged.`);
        return;
      }
    } catch {}
  }

  // Try opencode traversal if binary and key present (or even without key, try — free models may still work with dummy)
  const hasKey = !!process.env.OPENCODE_API_KEY || !!process.env.OPENCODE_API_KEY?.length || !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  console.log(`[discover] OPENCODE_API_KEY present: ${hasKey}, attempting opencode traversal...`);

  try {
    await generateWithTraversal(prompt);
    // Success — insights.md already written by agent
  } catch (e) {
    console.warn(`[discover] All opencode attempts failed (${e.message}), falling back to deterministic template`);
    const fallback = buildDeterministicInsights({ newSlugs, state });
    fs.writeFileSync(INSIGHTS_FILE, fallback, 'utf8');
    console.log(`[discover] Fallback insights.md written (${fallback.length} chars)`);
  }

  // Ensure insights.md exists and has required structure
  if (!fs.existsSync(INSIGHTS_FILE)) {
    const fallback = buildDeterministicInsights({ newSlugs, state });
    fs.writeFileSync(INSIGHTS_FILE, fallback, 'utf8');
  }
  const final = fs.readFileSync(INSIGHTS_FILE, 'utf8');
  console.log(`[discover] Done. insights.md preview:\n${final.slice(0, 800)}\n...`);

  // Exit code 0 always (PR will be created only if file changed)
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
