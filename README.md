<div align="center">

# DeepSeek Official Tracker

**The most complete, automated & verifiable feed for every DeepSeek official update — no rumors, no hallucinations.**

[![Track](https://github.com/awesome-deepseekharness/deepseek-official-tracker/actions/workflows/track.yml/badge.svg)](https://github.com/awesome-deepseekharness/deepseek-official-tracker/actions/workflows/track.yml)
[![Last Update](https://img.shields.io/github/last-commit/awesome-deepseekharness/deepseek-official-tracker?label=last%20update&color=0abf5b)](https://github.com/awesome-deepseekharness/deepseek-official-tracker/commits/main)
[![FEED](https://img.shields.io/badge/FEED-auto--updated-blue?logo=rss)](FEED.md)
[![License: CC0](https://img.shields.io/badge/License-CC0--1.0-lightgrey.svg)](LICENSE)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-V4%20%7C%20V3.2%20%7C%20R1-4B82E6?logo=openai)](https://www.deepseek.com)

*Auto-tracked by GitHub Actions every 6 hours. 6 sources · 0 LLM hallucinations · 100% verifiable links.*

[English](README.md) | [中文](README.zh.md) · [📡 FEED.md](FEED.md) · [📰 Website News](website-news.md) · [🤗 HuggingFace](huggingface.md)

**Sister Project:** [Awesome DeepSeek Harness](https://github.com/awesome-deepseekharness/awesome-deepseek-harness) — curated plugins & ecosystem for `dsh` (DeepSeek Harness) · **Official:** [platform.deepseek.com](https://platform.deepseek.com) | [api-docs.deepseek.com](https://api-docs.deepseek.com) | [deepseek.com](https://www.deepseek.com)

</div>

---

## TL;DR

> Tired of checking 5 different DeepSeek channels every morning? This repo does it for you. Single `FEED.md` aggregates **API changelog, API news, deepseek.com blog, GitHub releases/tags, npm, and Hugging Face models** — committed automatically with citation links. Watch this repo → get notified within 6 hours of any official release.

**Perfect for:** API users tracking model `deepseek-v4-pro`/`deepseek-v4-flash` pricing & deprecations · researchers watching DeepSeek-V3/R1/V3.2/V4 open-source weights · `dsh`/`DeepSeek-Harness` developers tracking CLI releases.

## 🔥 Latest — DeepSeek-V4-Pro GA (2026-08-13)

**DeepSeek-V4-Pro is now GA** on App, Web and API. Set `model="deepseek-v4-pro"` to use the latest `DeepSeek-V4-Pro-0813`.

- **Agent SOTA:** Terminal Bench 2.1 **87.9**, DeepSWE **62.7**, Toolathlon-Verified **74.1**, HLE **42.7/60.0** (w/wo tools)
- **Responses API native** — one-click script for Codex integration
- **Thinking effort:** `low` / `high` / `max` for V4-Pro & V4-Flash
- **Pricing:** peak/off-peak from **2026-08-16 16:00 UTC**, off-peak **½ price**

[Official announcement](https://api-docs.deepseek.com/news/news260813) · [Change Log](https://api-docs.deepseek.com/updates#date-2026-08-13) · [HuggingFace Pro-0813](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813)

<details>
<summary>Previous highlights</summary>

- **2026-08-21** Flash-Vision-Exp multimodal `deepseek-v4-flash-vision-exp` live
- **2026-07-31** V4-Flash public beta `deepseek-v4-flash`
- **2026-04-24** V4 Preview — 1M context era (`deepseek-v4-pro` / `deepseek-v4-flash`, legacy `deepseek-chat`/`deepseek-reasoner` sunsets 2026-07-24)
- **2025-12-01** V3.2 & V3.2-Speciale (thinking-in-tool-use)
</details>

---

## 📑 Table of Contents

- [Tracked Sources](#-tracked-sources--6-official-channels)
- [How it Works vs Others](#-how-it-works--how-were-different)
- [Subscribe / Use](#-subscribe--use)
- [Automation & Reliability](#️-automation--reliability)
- [Manual Run](#-manual-run)
- [FAQ](#-faq)
- [Keywords / SEO](#-keywords--seo)
- [Contributing & Related](#-contributing--related)
- [License](#-license)

## 📡 Tracked Sources — 6 official channels

> **Design principle:** Official only. No secondary news, no Twitter rumors, no LLM rewriting. Every line ends with a `[Source]` you can verify in 1 click. Inspired by best-practice trackers like `ai-news-radar` (10+ sources), `deeptrend` (14+ sources), `daily-hot-tracker` — but we optimize for **precision over volume**.

| # | Source | What it catches | Output | Frequency |
|---|--------|-----------------|--------|-----------|
| 1 | [DeepSeek API Change Log](https://api-docs.deepseek.com/updates) | Model GA/beta, pricing, deprecation, API feature flags | [api-changelog.md](api-changelog.md) | 6h |
| 2 | [DeepSeek API News](https://api-docs.deepseek.com/news) | Long-form official news (`news260813` etc) | [NEWS.md](NEWS.md) | 6h |
| 3 | [DeepSeek Official Website Blog](https://www.deepseek.com/en/news/) | Research blog, open-source announcements (V4-Preview, V3.2, Terminus…) — **often 1-2 days earlier than API docs** | [website-news.md](website-news.md) | 6h |
| 4 | [GitHub `deepseek-ai/*` Releases & Tags](https://github.com/deepseek-ai) | 25 repos: `DeepSeek-V3`/`R1`/`OCR`/`VL2`/`Coder-V2`/`Math-V2`/`Prover-V2`, `FlashMLA`/`DeepEP`/`DeepGEMM`/`3FS`/`smallpond`, `deepseek-harness`… | [releases.md](releases.md) | 6h |
| 5 | [Hugging Face `deepseek-ai`](https://huggingface.co/deepseek-ai) | New weights & checkpoints (`V4-Pro-0813`, `V4-Flash-0731`…), likes/downloads | [huggingface.md](huggingface.md) | 6h |
| 6 | [npm `@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh) | `dsh` CLI version bumps (`0.1.1-rc.2` etc) | [npm.md](npm.md) | 6h |
| — | **Combined timeline (newest first, deduplicated)** | — | **[FEED.md](FEED.md)** | 6h |

**Why 6 and not 1?** Previously only API docs were watched. Now we cover the full official surface — our audit found `deepseek.com` blog publishes ahead of API docs (e.g., V3.2), and Hugging Face weights often land hours before a blog post. Single-source = you miss it.

## 🧭 How it Works / How We're Different

```
api-docs.deepseek.com/updates ─┐
api-docs.deepseek.com/news    ─┤
www.deepseek.com/en/news      ─┼─► scripts/track.mjs ─► append-only *.md ─► FEED.md (sorted, deduped)
github.com/deepseek-ai/*      ─┤         ▲                         │
huggingface.co/deepseek-ai    ─┤         │ state.json (seen IDs)   └─► git commit & push (retry+rebase)
registry.npmjs.org/@deepseek… ─┘         └─ retry+timeout fetch, date validation, n/a handling
```

| Feature | This repo | Typical RSS/LMM summarizers (`ai-news-bot`, `meridian`, `quantum-rss-radar`) |
|---------|-----------|----------------------------------------------------------------------------------|
| Source scope | **6 official DeepSeek endpoints** | 20+ generic AI RSS + LLM rewrite |
| Hallucination risk | **Zero** (mirrors raw titles with citations) | Medium (LLM summarized) |
| Verifiability | Every entry has `[Source]` deep-link | Often no link or aggregated |
| Deduplication | `state.json` persistent IDs, no repeats | Usually daily dump |
| Latency | ≤6h, push-triggered on fix | 24h daily digest |
| Dependency | **Pure Node.js, no API key needed** (GH_TOKEN auto) | Requires LLM API key (DeepSeek/Claude) |

## 🔔 Subscribe / Use

**1. Watch this repo (recommended):** GitHub → `Watch` → `Custom` → `Releases`/all → email within minutes of `git push`. No RSS needed.

**2. Bookmark the feed:** Single file [`FEED.md`](FEED.md) is newest-first, 80 items, with valid `YYYY-MM-DD` dates (`n/a` only for GitHub tags without a timestamp). Ideal for quick scan.

**3. Consume as data:**

```bash
# All timelines as markdown
curl -s https://raw.githubusercontent.com/awesome-deepseekharness/deepseek-official-tracker/main/FEED.md

# Raw state for programmatic use (seen IDs)
curl -s https://raw.githubusercontent.com/awesome-deepseekharness/deepseek-official-tracker/main/data/state.json | jq .
```

**4. Feed into your own bot:** Re-use `scripts/track.mjs` — set `GITHUB_TOKEN` for higher GitHub rate limits, or `HF_TOKEN` if you mirror HF more aggressively.

## ⚙️ Automation & Reliability

- **Schedule:** `cron: 0 */6 * * *` (every 6h) + `workflow_dispatch` + push on `scripts/**` (so a fix instantly re-crawls).
- **Past failures:** 2 early `rejected` pushes on `2026-08-15 09:1x UTC` due to concurrent `git push` race. **Fixed:** `fetch-depth:0`, `pull --rebase --autostash` with 3-retry loop (`scripts/track.mjs:fetchText` also retries 3× with backoff, 15s timeout). Since fix: **40+ consecutive successes** (checked 2026-08-16 → 2026-08-27).
- **State:** `data/state.json` dedupes IDs (`changelog: 21, news: 9, websiteNews: 7, huggingface: 20` as of 2026-08-27). Corrupted entries auto-heal (date validation `YYYY-MM-DD`, tag vs release dedup).
- **No timestamp churn:** `FEED.md` header is stable except `last update:` ISO timestamp; no empty commits.

## 🛠️ Manual Run

```bash
git clone https://github.com/awesome-deepseekharness/deepseek-official-tracker
cd deepseek-official-tracker
node scripts/track.mjs          # needs Node 22+; no deps
# optional: GITHUB_TOKEN=ghp_xxx node scripts/track.mjs  # lifts GitHub 60 req/h limit
```

Files are append-only; re-running without new upstream items is a no-op.

## ❓ FAQ

**Q: Is this affiliated with DeepSeek?** No. Data belongs to their respective owners (DeepSeek, GitHub, npm, Hugging Face). We only mirror with citations under `CC0-1.0`.

**Q: Why is npm `@deepseek-ai/dsh` tracked but not PyPI?** DeepSeek's official `dsh` distributes via npm today. PyPI (`deepseek-ai` org) can be added on request — open an issue.

**Q: Do you rewrite titles with AI?** No. We keep official titles verbatim (entity-decoded) + 600-char summary from changelog HTML, with `[Source]` link. Zero LLM in the pipeline.

**Q: GitHub tags show `n/a` date?** GitHub `tags` API has no timestamp (only `releases` do). We keep `n/a` and sort them last in `FEED.md` — avoids fabricating `2012-26-` style bugs (fixed in `2026-08-27`).

**Q: How do I get notified instantly?** Use GitHub `Watch` → `Custom` → `Pull requests` and `Releases` still not instant? Better: enable `Watch` on Discussions or use an RSS bridge: `https://github.com/awesome-deepseekharness/deepseek-official-tracker/commits/main.atom`.

**Q: Can I add more deepseek-ai repos?** Yes, edit `scripts/track.mjs:OFFICIAL_REPOS` (25 today) and PR. We track active repos; archived forks are excluded.

**Q: HuggingFace shows `likes` and `downloads` — is it live?** Yes, pulled from `huggingface.co/api/models?author=deepseek-ai`. Sorted by `lastModified`.

## 🔍 Keywords / SEO

`deepseek` `deepseek api` `deepseek oficial tracker` `deepseek news` `deepseek changelog` `deepseek v4` `deepseek v4 pro` `deepseek v4 flash` `deepseek v3.2` `deepseek v3.2 exp` `deepseek r1` `deepseek r1 0528` `deepseek v3` `deepseek harness` `dsh deepseek` `deepseek github releases` `deepseek huggingface` `deepseek npm` `deepseek pricing` `deepseek context caching` `deepseek 1m context` `deepseek api docs`

> This repo is optimized for search: `deepseek official news`, `deepseek api changelog`, `deepseek releases`, `deepseek huggingface models`, `deepseek npm dsh`. Add `site:github.com deepseek tracker` to find it.

## 🤝 Contributing & Related

- **PRs welcome:** fixing a slug, adding a repo, improving `fetchText` resiliency. The script is vanilla Node.js (no deps) for easy review.
- **Issues:** Report a missed official channel — we aim to stay within 6h of any `deepseek-ai` or `deepseek.com` publication.
- **Related:**
  - [awesome-deepseek-harness](https://github.com/awesome-deepseekharness/awesome-deepseek-harness) — curated `dsh` plugins & agents
  - [deepseek-ai/awesome-deepseek-integration](https://github.com/deepseek-ai/awesome-deepseek-integration) — official integrations directory
  - Trackers we studied: `LearnPrompt/ai-news-radar`, `chrbailey/deeptrend`, `reformdai/daily-hot-tracker`, `giftedunicorn/ai-news-bot`

## 📄 License

[CC0-1.0](LICENSE) — Data belongs to their respective sources; this repo only mirrors and organizes them automatically. No affiliation with DeepSeek.

---

<div align="center">
<sub>Built with ❤️ for the DeepSeek community. Star ⭐ to get updates via GitHub trending — it helps others discover this tracker.</sub>
</div>
