<div align="center">

# DeepSeek Official Tracker

自动抓取 DeepSeek 官方新闻、发布与任何变更 — 由 GitHub Actions 每 6 小时自动更新。

Auto-tracked feed of DeepSeek official news, releases, and any changes — updated by GitHub Actions every 6 hours.

[English](README.md) | 中文 · [English](README.md) | [中文](README.zh.md)

**友链 / Sister Project:** [Awesome DeepSeek Harness](https://github.com/awesome-deepseekharness/awesome-deepseek-harness) — 精选 dsh 插件与生态项目合集

</div>

## 跟踪源 / Tracked Sources

| 源 / Source | 说明 / Description | 输出 / Output |
| --- | --- | --- |
| [DeepSeek API Change Log](https://api-docs.deepseek.com/updates) | 官方 API 变更日志(模型发布、定价、功能) | [api-changelog.md](api-changelog.md) |
| [DeepSeek Official News](https://api-docs.deepseek.com/news) | 官方新闻页(从变更日志中发现新闻链接) | [NEWS.md](NEWS.md) |
| [GitHub Releases & Tags](https://github.com/deepseek-ai) | deepseek-ai 组织全部活跃仓库的 release 与 tag | [releases.md](releases.md) |
| [npm: @deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) | 官方 dsh 包版本发布 | [npm.md](npm.md) |
| — | 综合时间线(新条目置顶) | [FEED.md](FEED.md) |

## 自动化 / Automation

- [.github/workflows/track.yml](.github/workflows/track.yml) — 每 6 小时定时运行(`cron: 0 */6 * * *`),也支持手动触发(`workflow_dispatch`)
- [scripts/track.mjs](scripts/track.mjs) — 抓取脚本(Node.js,零依赖,仅用内置 fetch)
- 去重状态保存在 [data/state.json](data/state.json),只追加新条目,已见条目不重复提交
- 有更新时由 `github-actions[bot]` 自动提交推送

## 自动化 / Automation Flow

```mermaid
graph LR
  A[GitHub Actions<br/>每 6 小时] --> B[track.mjs]
  B --> C[api-docs.deepseek.com<br/>Change Log + News]
  B --> D[api.github.com<br/>deepseek-ai releases/tags]
  B --> E[registry.npmjs.org<br/>@deepseek-ai/dsh]
  C --> F[state.json 去重]
  D --> F
  E --> F
  F --> G[更新 markdown 输出]
  G --> H[有变更?]
  H -->|是| I[bot 自动提交推送]
  H -->|否| J[跳过]
```

## 手动触发 / Manual Run

```bash
# 本地运行(无需安装依赖)
node scripts/track.mjs

# 或仓库页面: Actions → Track DeepSeek Official Updates → Run workflow
```

## 贡献 / Contributing

发现新的官方源?欢迎提 Issue 或 PR。

## License

[CC0-1.0](LICENSE) — 数据归各自来源所有;本仓库仅做自动镜像整理。