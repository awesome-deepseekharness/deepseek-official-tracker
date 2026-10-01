# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated — the maintainer chose to introduce a framework for the Pages redesign. Framework selection was raised but not yet confirmed; the incumbent generator is `scripts/build-pages.mjs`, which emits a single inline HTML/CSS file with no build step, no `package.json`, and no npm dependencies, consumed by `.github/workflows/pages.yml` (Node 22, bare `node scripts/build-pages.mjs`).

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
- **Append-only, idempotent data files.** Re-running `track.mjs` with no new upstream items is a no-op; it skips the write entirely when nothing is new.
- **Bilingual docs, English-only data.** `README.md` and `README.zh.md` are structurally 1:1 and a CI health check fails on drift between them. `FEED.md` and all six source files are English-only; `insights.md` carries an optional one-sentence Chinese summary.
- **Rate limits shape the design.** `GITHUB_TOKEN` is auto-injected to lift GitHub's 60 req/h anonymous limit; `CONTRIBUTING.md` states 403 is expected without it and asks for ~300ms between paginated fetches. arXiv additionally 429s on rapid repeat calls.

## Capabilities and Constraints

- **Six tracked official sources**, each with a dedicated output file: `api-changelog.md`, `NEWS.md`, `website-news.md`, `releases.md` (28 hardcoded repos in `OFFICIAL_REPOS`), `huggingface.md`, `npm.md`. Aggregated newest-first into `FEED.md`, capped at 80 items.
- **Multi-corner AI discovery** (`scripts/corners.mjs`, 12 corners, all key-free) layered on top of the deterministic tracker, tiered `official` / `secondary` / `community`.
- **Node 22+, zero npm dependencies.** No `package.json` exists. `scripts/scope-watch.test.mjs` runs under `node:test` as a gate step inside `scope.yml` — there is no standalone CI test job.
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
- `site/feed.json` — machine-readable `{generatedAt, count, items[]}`, `count: 80` as of 2026-10-01T04:13Z.
- `data/state.json` — 6 arrays of seen IDs (`changelog`, `news`, `websiteNews`, `releases`, `npm`, `huggingface`), content reaching back to 2024-05-17.
- `data/health.json` — last written 2026-09-14, `ok: true`, `issueCount: 0`, per-file entry counts, `feedItems: 79`.
- `insights.md` — 15,312 chars of real AI research output (2026-09-10), covering the V4.1-Flash launch with Reddit, HN, X, and tech-media sources.
- Verified live first-party content: the deepseek.com blog (V4.1-Flash, 2026-09-10), `api-docs.deepseek.com/updates`, `deepseek-ai/deepseek-harness` releases (`dsh-v0.2.0-rc.2`, 2026-09-29), HuggingFace `deepseek-ai/DeepSeek-V4.1-Flash`, npm `@deepseek-ai/dsh`.

**Absences future work must not fabricate:** no testimonials, no user counts, no star counts, no performance or benchmark claims, no pricing claims beyond what the changelog itself states, no uptime or coverage guarantees. GitHub Actions badges are the only proof-of-operation available.

## Product Principles

1. **The link is the product.** A claim without a `[Source]` is a defect. Every surface must make verification one click away, never more.
2. **Deterministic first, AI second.** The tracked feed is zero-LLM by design. AI output is a clearly-labeled draft behind human review, never the substrate.
3. **Append-only and idempotent.** Nothing is rewritten or removed; re-running with no new upstream data changes no bytes.
4. **Six hours is the promise.** Latency is a product feature, and the UI should make the last-build time continuously legible.
5. **No API keys in the critical path.** The deterministic pipeline and all twelve discovery corners must keep working with zero configuration.

## Accessibility & Inclusion

No product-specific requirement has been established. No framework, accessibility tooling, or design system currently exists in the repo; the incumbent page has no skip link, no focus styling, and no ARIA.
