<div align="center">

# DeepSeek Official Tracker

自动抓取 DeepSeek 官方新闻、发布与变更,每 6 小时自动更新。
Auto-tracked feed of DeepSeek official news, releases, and any changes — updated by GitHub Actions every 6 hours.

[English](README.md) | 中文

**友链:** [Awesome DeepSeek Harness](https://github.com/awesome-deepseekharness/awesome-deepseek-harness) — 精选 dsh 插件与生态项目合集

</div>

## 最新动态

### [2026-08-13] DeepSeek-V4-Pro GA 正式发布

**DeepSeek-V4-Pro** 已在 APP、Web、API 全面上线,模型名设为 `deepseek-v4-pro` 即可使用最新版本。

- **Agent 能力大幅增强** — Terminal Bench 2.1: 87.9,DeepSWE: 62.7,Toolathlon-Verified: 74.1,HLE(wo/w tools): 42.7/60.0
- **原生支持 Responses API** — 为 Codex 专门适配,提供一键配置脚本
- **更灵活的思考强度控制** — V4-Pro / V4-Flash 现支持 `low` / `high` / `max` 三档
- **API 价格调整** — 2026-08-16 16:00 (UTC) 起实行峰谷定价,低谷时段半价

[官方公告](https://api-docs.deepseek.com/news/news260813) · [变更日志](https://api-docs.deepseek.com/updates#date-2026-08-13)

---

## 跟踪源

| 源 | 说明 | 输出 |
| --- | --- | --- |
| [DeepSeek API 变更日志](https://api-docs.deepseek.com/updates) | 官方 API 变更(模型发布、定价、功能) | [api-changelog.md](api-changelog.md) |
| [DeepSeek 官方新闻](https://api-docs.deepseek.com/news) | 官方新闻页 | [NEWS.md](NEWS.md) |
| [GitHub Releases & Tags](https://github.com/deepseek-ai) | deepseek-ai 全部活跃仓库 | [releases.md](releases.md) |
| [npm: @deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) | 官方 dsh 包版本 | [npm.md](npm.md) |
| 综合时间线(最新在前) | — | [FEED.md](FEED.md) |

## 自动化

由 GitHub Actions 每 6 小时自动抓取并提交(`cron: 0 */6 * * *`),可手动触发;只追加新条目,已见条目不重复。

## 手动运行

```bash
node scripts/track.mjs
```

## License

[CC0-1.0](LICENSE) — 数据归各自来源所有;本仓库仅做自动镜像整理。