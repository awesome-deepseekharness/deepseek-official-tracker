# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro, static output, no client hydration. `scripts/build-pages.mjs` stages the eight tracked markdown files and `feed.json` into `site/public/`, then runs `astro build`; the page is `site/src/pages/index.astro` plus `site/src/lib/transit.mjs`, which recovers the release-to-source structure from the committed markdown. `pages.yml` runs the same build on pull requests and deploys `site/dist` only from `main`.

## Users

Everyone tracking DeepSeek, and people who want to start paying attention to it. Two confirmed sub-audiences from the README:

- **API users** tracking `deepseek-v4.1-flash`, `deepseek-v4-pro`, and `deepseek-v4-flash` pricing changes and deprecation warnings. Their job: find out whether anything requires a code change on their side.
- **Open-weights researchers and `dsh` / DeepSeek-Harness CLI developers** following V3, R1, V3.2, V4, and V4.1 weight releases, arXiv papers, and HuggingFace model publications.

A third, broader audience — people not yet deeply interested in DeepSeek — is an explicit goal of the redesign owner. Note this sits in tension with the product's update cadence (a feed that changes every 6 hours does not by itself attract a first-time visitor); recorded as an open goal, not a solved requirement.

## Product Purpose

The problem, stated in `README.md:27`: checking six different DeepSeek channels every morning. A single `FEED.md` aggregates the API changelog, API news, the deepseek.com blog, GitHub releases and tags, npm, and HuggingFace models — committed automatically with citation links. Watching the repo returns a notification within six hours of any official release.

Success means the visitor can answer "did DeepSeek ship anything official since I last looked, and where is the proof" in one scan, without opening six pages.

## Positioning

The mechanism is deterministic mirroring with citation links, not summarization. Official titles are copied verbatim, each entry carries a `[Source]` deep-link, and `data/state.json` provides persistent-ID dedup so nothing repeats.

The verifiable claim is structural, not editorial: the deterministic pipeline (`scripts/track.mjs`) runs with **zero LLM involvement**, and the only AI-generated artifact (`insights.md`) is gated behind a pull request that carries the instruction **"Do not auto-merge: verify every `[Source]` link and date, check for hallucinations."** A competitor cannot copy this claim without also adopting that separation.

Against 20+ generic RSS options, the stated differentials are: 6 official endpoints rather than aggregators, a zero hallucination risk, a `[Source]` link on every entry, ≤6h latency, and no API key required.

## Operating Context

- **Automation is the product.** Seven GitHub Actions workflows carry it: `track` (every 6h, commits `FEED.md`), `discover` (daily 03:30 UTC, PR-gated AI insights), `pages` (deploys the static site), `scope` (weekly, proposes new official repos), `health` (daily janitor, opens a rolling issue), plus `auto-review` and `triage` (AI agents with PR write paths).
- **The consumer loop is GitHub-native:** Watch the repo → email on push. `README.md:102` states "No RSS needed" and offers the commits `.atom` feed as an alternative. Raw `curl` against `FEED.md` and `data/state.json` is a documented consumption path, as is `site/feed.json`.
- **Append-only, idempotent data files.** Re-running `track.mjs` with no new
  upstream items writes zero bytes and the cron commits nothing. This includes
  the `FEED.md` build stamp: it used to be rewritten unconditionally, so every
  six-hour run produced a one-line commit whether or not DeepSeek had shipped
  anything, which made the commit history read as activity and left "last
  updated" meaning "last run".
- **Bilingual docs, English-only data.** `README.md` and `README.zh.md` are structurally 1:1 and a CI health check fails on drift between them. `FEED.md` and all six source files are English-only; `insights.md` carries an optional one-sentence Chinese summary.
- **Rate limits shape the design.** `GITHUB_TOKEN` is auto-injected to lift GitHub's 60 req/h anonymous limit; `CONTRIBUTING.md` states 403 is expected without it and asks for ~300ms between paginated fetches. arXiv additionally 429s on rapid repeat calls.

## Capabilities and Constraints

- **Six tracked official sources**, each with a dedicated output file: `api-changelog.md`, `NEWS.md`, `website-news.md`, `releases.md` (28 hardcoded repos in `OFFICIAL_REPOS`), `huggingface.md`, `npm.md`. Aggregated newest-first into `FEED.md`, capped at 80 items.
- **Multi-corner AI discovery** (`scripts/corners.mjs`, 12 corners, all key-free) layered on top of the deterministic tracker, tiered `official` / `secondary` / `community`.
- **Node 22+. The data pipeline has zero npm dependencies; the site does not.**
  No `package.json` exists at the repo root and `scripts/*.mjs` are plain Node.
  The Pages surface is a separate Astro project under `site/` with its own
  committed `package-lock.json`, installed by `pages.yml` with `npm ci` and built
  by `scripts/build-pages.mjs`, which stages the tracker's markdown into
  `site/public/` before running `astro build`. `scripts/scope-watch.test.mjs` runs
  under `node:test` as a gate step inside `scope.yml`.
- **Secrets:** the deterministic pipeline needs none. The experimental AI workflows use `OPENCODE_API_KEY` and/or `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`, and fall back to a deterministic template when absent.
- **Agents must never push to `main`** or run `git push` (`.opencode/agent/triage.md:48`).
- **Undecided:** whether unverified community signals (Reddit, HN, X replies, media headlines) may appear on the public site. The maintainer asked for the fastest possible signal including "rumors", which conflicts with the zero-hallucination positioning above. Not resolved.

## Brand Commitments

- **Name:** "DeepSeek Official Tracker". Sister project: `awesome-deepseek-harness`.
- **"Official" is load-bearing.** The name, the `[Source]`-on-every-entry rule, and the zero-LLM pipeline are one commitment; loosening any of them changes what the product claims to be.
- **Verifiability language is specific:** "no rumors, no hallucinations", "100% verifiable links", "Zero LLM in the pipeline". Do not soften or generalize these into "accurate" or "up to date".
- **Licensing:** `CC0-1.0`. Data belongs to the respective owners; the repo mirrors and organizes automatically. Explicitly not affiliated with DeepSeek (`README.md:139`).
- The footer credit "Built with ❤️ for DeepSeek community" is an established voice commitment.

## Evidence on Hand

Real, currently-live material the surface can and should render:

- `FEED.md` — 80 real entries, dated, with `[Source]` links.
- `site/feed.json` — machine-readable `{generatedAt, count, items[]}`, `count: 80`.
- `data/state.json` — 6 arrays of seen IDs (`changelog`, `news`, `websiteNews`, `releases`, `npm`, `huggingface`), content reaching back to 2024-05-17.
- `data/health.json` — written by the daily janitor, `ok`, with per-file entry counts.
- `insights.md` — real AI research output behind a PR gate, covering the V4.1-Flash launch with Reddit, HN, X, and tech-media sources.
- Verified live first-party content: the deepseek.com blog (V4.1-Flash, 2026-09-10), `api-docs.deepseek.com/updates`, `deepseek-ai/deepseek-harness` releases (`dsh-v0.2.0-rc.2`, 2026-09-29), HuggingFace `deepseek-ai/DeepSeek-V4.1-Flash`, npm `@deepseek-ai/dsh`.

**Absences future work must not fabricate:** no testimonials, no user counts, no star counts, no performance or benchmark claims, no pricing claims beyond what the changelog itself states, no uptime or coverage guarantees. GitHub Actions badges are the only proof-of-operation available.

## Product Principles

1. **The link is the product.** A claim without a `[Source]` is a defect. Every surface must make verification one click away, never more.
2. **Deterministic first, AI second.** The tracked feed is zero-LLM by design. AI output is a clearly-labeled draft behind human review, never the substrate.
3. **Append-only and idempotent.** Nothing is rewritten or removed; re-running with no new upstream data changes no bytes.
4. **Six hours is the promise.** Latency is a product feature, and the UI should
   make the feed's last-change time continuously legible. It is labelled as the
   last *change*, distinct from the page compile time, because the two are
   different facts.
5. **No API keys in the critical path.** The deterministic pipeline and all twelve discovery corners must keep working with zero configuration.

## Accessibility & Inclusion

The page ships a skip link, `aria-label`s on the nav, source legend and step numbers, and `aria-hidden` on decorative glyphs. No accessibility tooling, component library or design system exists in the repo — `DESIGN.md` documents the visual rules by hand, and `scripts/contrast.mjs` checks the palette against WCAG on the built CSS as a CI gate. There is no automated axe or keyboard-order test.
