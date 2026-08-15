<div align="center">

# DeepSeek Official Tracker

Auto-tracked feed of DeepSeek official news, releases, and any changes — updated by GitHub Actions every 6 hours.
自动抓取 DeepSeek 官方新闻、发布与变更,每 6 小时自动更新。

[English](README.md) | [中文](README.zh.md)

**Sister Project:** [Awesome DeepSeek Harness](https://github.com/awesome-deepseekharness/awesome-deepseek-harness) — curated plugins & ecosystem for dsh

</div>

## Latest / 最新动态

### [2026-08-13] DeepSeek-V4-Pro GA Release · V4-Pro 正式发布

The GA release of **DeepSeek-V4-Pro** has been rolled out on the APP, Web, and API. Set the model name to `deepseek-v4-pro` to use the latest version.

- **Significantly enhanced agent capabilities** — Terminal Bench 2.1: 87.9, DeepSWE: 62.7, Toolathlon-Verified: 74.1, HLE (wo/w tools): 42.7/60.0
- **Native support for the Responses API** — specially adapted for Codex, with a one-click configuration script
- **Flexible thinking effort control** — V4-Pro / V4-Flash now support `low` / `high` / `max` effort levels
- **API pricing adjustment** — peak/off-peak pricing takes effect 2026-08-16 16:00 UTC, off-peak at half price

[Official announcement](https://api-docs.deepseek.com/news/news260813) · [Change Log](https://api-docs.deepseek.com/updates#date-2026-08-13)

---

## Tracked Sources / 跟踪源

| Source | Description | Output |
| --- | --- | --- |
| [DeepSeek API Change Log](https://api-docs.deepseek.com/updates) | Official API changelog (model releases, pricing, features) | [api-changelog.md](api-changelog.md) |
| [DeepSeek Official News](https://api-docs.deepseek.com/news) | Official news pages | [NEWS.md](NEWS.md) |
| [GitHub Releases & Tags](https://github.com/deepseek-ai) | All active `deepseek-ai` repositories | [releases.md](releases.md) |
| [npm: @deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) | Official dsh package versions | [npm.md](npm.md) |
| Combined timeline (newest first) | — | [FEED.md](FEED.md) |

## Automation / 自动化

Fetched and committed automatically by GitHub Actions every 6 hours (`cron: 0 */6 * * *`), also triggerable manually. New items are appended; seen items are never repeated.
由 GitHub Actions 每 6 小时自动抓取并提交,可手动触发;只追加新条目,已见条目不重复。

## Manual Run / 手动运行

```bash
node scripts/track.mjs
```

## License

[CC0-1.0](LICENSE) — Data belongs to their respective sources; this repo only mirrors and organizes them automatically.