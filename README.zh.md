<div align="center">

# DeepSeek 官方动态追踪

**最全、自动、可验证的 DeepSeek 官方更新追踪 — 无谣言、无幻觉，每条可溯源。**

[![Track](https://github.com/awesome-deepseekharness/deepseek-official-tracker/actions/workflows/track.yml/badge.svg)](https://github.com/awesome-deepseekharness/deepseek-official-tracker/actions/workflows/track.yml)
[![Last Update](https://img.shields.io/github/last-commit/awesome-deepseekharness/deepseek-official-tracker?label=%E6%9C%80%E5%90%8E%E6%9B%B4%E6%96%B0&color=0abf5b)](https://github.com/awesome-deepseekharness/deepseek-official-tracker/commits/main)
[![FEED](https://img.shields.io/badge/FEED-%E8%87%AA%E5%8A%A8%E6%9B%B4%E6%96%B0-blue?logo=rss)](FEED.md)
[![License: CC0](https://img.shields.io/badge/License-CC0--1.0-lightgrey.svg)](LICENSE)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-V4%20%7C%20V3.2%20%7C%20R1-4B82E6)](https://www.deepseek.com)

*GitHub Actions 每 6 小时自动抓取。6 大官方源 · 0 幻觉 · 100% 可验证链接。*

[中文](README.zh.md) | [English](README.md) · [📡 FEED.md](FEED.md) · [📰 官网新闻](website-news.md) · [🤗 HuggingFace](huggingface.md)

**友链：** [Awesome DeepSeek Harness](https://github.com/awesome-deepseekharness/awesome-deepseek-harness) — 精选 `dsh` 插件与生态合集 · **官方：** [platform.deepseek.com](https://platform.deepseek.com) | [api-docs.deepseek.com](https://api-docs.deepseek.com) | [deepseek.com](https://www.deepseek.com)

</div>

---

## TL;DR

> 每天要刷 5 个 DeepSeek 官方渠道太累？这个仓库帮你一站聚合。单个 `FEED.md` 聚合 **API 变更日志、API 新闻、官网博客、GitHub Releases/Tags、npm、HuggingFace 模型**——自动提交、带溯源链接。Watch 本仓库 → 官方发布后 6 小时内邮件通知。

**适合：** 关注 `deepseek-v4-pro`/`deepseek-v4-flash` 计费与弃用通知的 API 用户 · 追踪 DeepSeek-V3/R1/V3.2/V4 开源权重的开发者 · `dsh`/`DeepSeek-Harness` CLI 用户。

## 🔥 最新 — DeepSeek-V4-Pro 正式版 (2026-08-13)

**DeepSeek-V4-Pro 已 GA**，在 App、Web、API 全量上线，`model="deepseek-v4-pro"` 即用最新 `DeepSeek-V4-Pro-0813`。

- **Agent 能力 SOTA：** Terminal Bench 2.1 **87.9**、DeepSWE **62.7**、Toolathlon-Verified **74.1**、HLE **42.7/60.0**
- **原生 Responses API** — 为 Codex 适配，一键配置脚本
- **思考强度：** `low` / `high` / `max` 三档（V4-Pro / V4-Flash）
- **计费：** **2026-08-16 16:00 UTC** 起峰谷定价，低谷 **半价**

[官方公告](https://api-docs.deepseek.com/news/news260813) · [变更日志](https://api-docs.deepseek.com/updates#date-2026-08-13) · [HuggingFace Pro-0813](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813)

<details>
<summary>往期重点</summary>

- **2026-08-21** Flash-Vision-Exp 多模态 `deepseek-v4-flash-vision-exp` 上线
- **2026-07-31** V4-Flash 公测 `deepseek-v4-flash`
- **2026-04-24** V4 Preview — 1M 上下文时代（`deepseek-v4-pro`/`deepseek-v4-flash`，旧 `deepseek-chat`/`deepseek-reasoner` 于 2026-07-24 退役）
- **2025-12-01** V3.2 & V3.2-Speciale（thinking-in-tool-use）
</details>

---

## 📑 目录

- [跟踪源](#-跟踪源--6-大官方渠道)
- [原理与差异](#-原理与差异)
- [订阅与使用](#-订阅与使用)
- [自动化与可靠性](#️-自动化与可靠性)
- [手动运行](#-手动运行)
- [FAQ](#-faq)
- [关键词 / SEO](#-关键词--seo)
- [贡献与相关](#-贡献与相关)
- [License](#-license)

## 📡 跟踪源 — 6 大官方渠道

> **设计原则：** 只追官方。不追二手新闻、Twitter 谣言、AI 改写。每条以 `[Source]` 结尾，一键可验证。参考了 `ai-news-radar`（10+ 源）、`deeptrend`（14+ 源）、`daily-hot-tracker` 等优秀追踪器的实践，但我们更重 **准确性而非数量**。

| # | 来源 | 覆盖 | 输出 | 频率 |
|---|------|------|------|------|
| 1 | [DeepSeek API 变更日志](https://api-docs.deepseek.com/updates) | 模型 GA/beta、计费、弃用、API 特性开关 | [api-changelog.md](api-changelog.md) | 6h |
| 2 | [DeepSeek API 官方新闻](https://api-docs.deepseek.com/news) | 长篇官方新闻（`news260813` 等） | [NEWS.md](NEWS.md) | 6h |
| 3 | [DeepSeek 官网博客](https://www.deepseek.com/en/news/) | 研究博客与开源发布（V4-Preview、V3.2、Terminus…）——**常比 API 文档早 1-2 天** | [website-news.md](website-news.md) | 6h |
| 4 | [GitHub `deepseek-ai/*` Releases & Tags](https://github.com/deepseek-ai) | 25 个仓库：`DeepSeek-V3`/`R1`/`OCR`/`VL2`/`Coder-V2`/`Math-V2`/`Prover-V2`、`FlashMLA`/`DeepEP`/`DeepGEMM`/`3FS`/`smallpond`、`deepseek-harness`… | [releases.md](releases.md) | 6h |
| 5 | [Hugging Face `deepseek-ai`](https://huggingface.co/deepseek-ai) | 新权重与 checkpoint（`V4-Pro-0813`、`V4-Flash-0731`…）、likes/downloads | [huggingface.md](huggingface.md) | 6h |
| 6 | [npm `@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh) | `dsh` CLI 版本（`0.1.1-rc.2` 等） | [npm.md](npm.md) | 6h |
| — | **综合时间线（最新在前，已去重）** | — | **[FEED.md](FEED.md)** | 6h |

**为什么从 4 源扩到 6 源？** 之前仅看 API 文档会漏：官网博客常提前于 API 文档（如 V3.2），HuggingFace 权重常在博客前数小时上线。单一源必然漏报。

## 🧭 原理与差异

```
api-docs.deepseek.com/updates ─┐
api-docs.deepseek.com/news    ─┤
www.deepseek.com/en/news      ─┼─► scripts/track.mjs ─► 追加写入 *.md ─► FEED.md（排序、去重）
github.com/deepseek-ai/*      ─┤         ▲                         │
huggingface.co/deepseek-ai    ─┤         │ state.json（已见ID）    └─► git commit & push（重试+rebase）
registry.npmjs.org/@deepseek… ─┘         └─ 带重试/超时的 fetch、日期校验、n/a 兜底
```

| 特性 | 本仓库 | 典型 RSS/LLM 总结器（`ai-news-bot`、`meridian`、`quantum-rss-radar`） |
|------|--------|-----------------------------------------------------------------------------------|
| 来源 | **6 个 DeepSeek 官方端点** | 20+ 泛 AI RSS + LLM 改写 |
| 幻觉风险 | **零**（原文标题+引用） | 中等（LLM 总结） |
| 可验证性 | 每条带 `[Source]` 深链 | 常无链接或聚合 |
| 去重 | `state.json` 持久化 ID，不重复 | 多为每日全量 |
| 延迟 | ≤6h，修复后即时 push 触发 | 24h 日报 |
| 依赖 | **纯 Node.js，无需 API Key**（GH_TOKEN 自动） | 需 LLM API Key（DeepSeek/Claude） |

## 🔔 订阅与使用

**1. Watch 本仓库（推荐）：** GitHub → `Watch` → `Custom` → 勾选全部 → 每次 `git push` 邮件通知，无需 RSS。

**2. 收藏 FEED：** 单文件 [`FEED.md`](FEED.md) 最新在前、80 条、带合法 `YYYY-MM-DD` 日期（仅 GitHub tag 无时间戳时为 `n/a`），适合快速扫视。

**3. 当数据消费：**

```bash
# 时间线
curl -s https://raw.githubusercontent.com/awesome-deepseekharness/deepseek-official-tracker/main/FEED.md

# 机器可读状态
curl -s https://raw.githubusercontent.com/awesome-deepseekharness/deepseek-official-tracker/main/data/state.json | jq .
```

**4. 接入自己的机器人：** 直接复用 `scripts/track.mjs`——设置 `GITHUB_TOKEN` 可提额，`HF_TOKEN` 可更激进地镜像 HF。

## ⚙️ 自动化与可靠性

- **调度：** `cron: 0 */6 * * *`（每 6h）+ `workflow_dispatch` + `scripts/**` 变更时 push 触发（修复后立即重抓）。
- **历史失败：** 早期 `2026-08-15 09:1x UTC` 有 2 次 `rejected`（并发 `git push` 竞态）。**已修复：** `fetch-depth:0`、`pull --rebase --autostash` 3 次重试（`scripts/track.mjs:fetchText` 亦 3 次重试、15s 超时）。修复后 **连续 40+ 次成功**（2026-08-16 → 2026-08-27）。
- **状态：** `data/state.json` 记录已见 ID（截至 2026-08-27：`changelog:21, news:9, websiteNews:7, huggingface:20`）。异常条目自动自愈（日期校验 `YYYY-MM-DD`、tag/release 去重）。
- **无时间戳抖动：** `FEED.md` 头部仅 `last update:` 的 ISO 时间会变，不会产生无意义空提交。

## 🛠️ 手动运行

```bash
git clone https://github.com/awesome-deepseekharness/deepseek-official-tracker
cd deepseek-official-tracker
node scripts/track.mjs          # 需 Node 22+，零依赖
# 可选：GITHUB_TOKEN=ghp_xxx node scripts/track.mjs  # 解除 GitHub 60 次/小时限制
```

文件为追加模式；无新上游时重复运行为 no-op。

## ❓ FAQ

**Q: 是否官方仓库？** 否。数据归各自来源所有（DeepSeek、GitHub、npm、Hugging Face），本仓仅做镜像整理，`CC0-1.0`。

**Q: 为什么追 npm `@deepseek-ai/dsh` 而不是 PyPI？** DeepSeek 官方 `dsh` 当前经 npm 分发。PyPI（`deepseek-ai` 组织）可按需补充——欢迎提 issue。

**Q: 会用 AI 改写标题吗？** 不会。保留官方原文标题（实体解码）+ 变更日志 600 字符摘要，带 `[Source]`。流水线零 LLM。

**Q: GitHub tag 为什么显示 `n/a`？** GitHub `tags` API 无时间戳（仅 `releases` 有）。我们保留 `n/a` 并在 `FEED.md` 中排最后，避免伪造 `2012-26-` 式错误（已于 2026-08-27 修复）。

**Q: 如何即时通知？** 用 GitHub `Watch` → `Custom` → 全选。或订阅 atom：`https://github.com/awesome-deepseekharness/deepseek-official-tracker/commits/main.atom`。

**Q: 能否新增 deepseek-ai 仓库？** 可以，改 `scripts/track.mjs:OFFICIAL_REPOS`（目前 25 个）后提 PR，我们只追活跃仓，归档 fork 不计。

**Q: HuggingFace 的 `likes`/`downloads` 是实时的吗？** 是，取自 `huggingface.co/api/models?author=deepseek-ai`，按 `lastModified` 排序。

## 🔍 关键词 / SEO

`deepseek` `deepseek api` `deepseek 官方` `deepseek 追踪` `deepseek 新闻` `deepseek 变更日志` `deepseek v4` `deepseek v4 pro` `deepseek v4 flash` `deepseek v3.2` `deepseek v3.2 exp` `deepseek r1` `deepseek r1 0528` `deepseek v3` `deepseek harness` `dsh deepseek` `deepseek github` `deepseek huggingface` `deepseek npm` `deepseek 计费` `deepseek context caching` `deepseek 1m 上下文` `deepseek api docs`

> 本仓库针对搜索优化：`deepseek 官方新闻`、`deepseek api 变更`、`deepseek 开源发布`、`deepseek huggingface 模型`、`deepseek npm dsh`。在 GitHub 搜索 `deepseek tracker` 或 `deepseek 官方` 即可找到。

## 🤝 贡献与相关

- **欢迎 PR：** 修 slug、加仓库、提升 `fetchText` 健壮性。脚本为纯 Node.js（零依赖）便于审计。
- **提 Issue：** 发现漏掉的官方渠道——我们的目标是任何 `deepseek-ai` 或 `deepseek.com` 发布后 6h 内收录。
- **相关：**
  - [awesome-deepseek-harness](https://github.com/awesome-deepseekharness/awesome-deepseek-harness) — 精选 `dsh` 插件与 Agent
  - [deepseek-ai/awesome-deepseek-integration](https://github.com/deepseek-ai/awesome-deepseek-integration) — 官方集成目录
  - 调研过的追踪器：`LearnPrompt/ai-news-radar`、`chrbailey/deeptrend`、`reformdai/daily-hot-tracker`、`giftedunicorn/ai-news-bot`

## 📄 License

[CC0-1.0](LICENSE) — 数据归各自来源所有；本仓库仅做自动镜像整理。与 DeepSeek 无隶属关系。

---

<div align="center">
<sub>为 DeepSeek 社区用 ❤️ 构建。点 Star ⭐ 让更多人通过 GitHub 趋势发现本追踪器。</sub>
</div>
