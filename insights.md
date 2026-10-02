# Insights — DeepSeek Deep Discovery — 2026-10-02

> Source-checked research snapshot as of 2026-10-02 UTC. Official evidence,
> media reports and unverified leads are separated below. No launch date is
> inferred from when this tracker first observed a page.

## Summary

DeepSeek has shipped more than model announcements. Its current Harness product
page provides Windows and macOS desktop downloads, and describes plugin-based
workflows and scheduled tasks. The latest GitHub/CLI release checked remains
`dsh-v0.2.0-rc.2` from September 29, explicitly marked prerelease. Separately,
DeepGEMM-Ascend's first-party README dates its initial open-source release to
September 30. These product and infrastructure updates explain why the older
September 10 model headline was an incomplete view of what changed.

中文：新增消息包含 Harness 桌面端和昇腾基础设施，并不只有模型发布。桌面端官网已可下载，但 CLI 当前版本仍标为候选版；官网观测日期不等于发布日。

## New findings (verified only)

### Harness desktop — official page observed 2026-10-02

- The live official page is titled **DeepSeek Harness｜共探智能上限**, with the
  headline **DeepSeek Harness 现在，开箱即用**. It links to Windows x64 `.exe`
  and macOS arm64 `.dmg` installers on `download.deepseek.com`, and describes
  document work, spreadsheet analysis, coding, scheduled tasks and plugins.
  This confirms desktop availability; the page does not state a publication
  date. October 2 is this review's observation date, not a claimed launch date.
  [Source](https://www.deepseek.com/harness/)
- The latest checked GitHub release is **dsh-v0.2.0-rc.2**, published
  **2026-09-29**, with `prerelease: true`. npm also points `latest` and `next`
  to `0.2.0-rc.2`; the tag name latest does not turn a release candidate into a
  stable release. [Source](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)
  [Source](https://registry.npmjs.org/@deepseek-ai/dsh)

### Ascend infrastructure — first-party evidence

- **DeepGEMM-Ascend**, initial release **2026-09-30**: its README explicitly
  dates the initial release and describes Ascend 950 support and compatibility
  with DeepGEMM APIs. The OSS release commit provides a dated immutable anchor.
  [Source](https://github.com/deepseek-ai/DeepGEMM-Ascend/commit/8491bbb4b8c02a094a2318965f50c70438a3e73c)
  [Source](https://raw.githubusercontent.com/deepseek-ai/DeepGEMM-Ascend/main/README.md)
- **DeepEP-Ascend**, repository inspected **2026-10-02**: the official README
  describes MoE expert-parallel communication on Huawei Ascend NPUs and
  alignment with the NVIDIA implementation's public buffer APIs. Its published
  benchmarks use a PoC HDK; the planned public commercial firmware is not
  claimed to be available yet. [Source](https://raw.githubusercontent.com/deepseek-ai/DeepEP-Ascend/main/README.md)

## Secondary signals

- **2026-09-30 — media report:** 爱范儿's desktop hands-on report, republished
  by 36Kr, describes Windows/macOS installation, plugin management and scheduled
  automation. These are the outlet's reported experiences, not independent
  benchmarks by this tracker. Desktop download availability was separately
  confirmed on the official product page above.
  [Source](https://eu.36kr.com/zh/p/4005355518726025)
- **2026-09-30 — media report:** InfoQ describes the Ascend infrastructure
  collection and differentiates the roles and limitations of TileLang,
  DeepGEMM, DeepEP, FlashMLA, TileKernels and DeepSelect. The broader six-component
  framing is attributed to InfoQ; only the first-party items actually checked
  above are presented here as independently verified findings.
  [Source](https://www.infoq.cn/article/t5i2Yv2z0LwIbK36lteR)

## Community signals

Dated HN, Reddit, V2EX, GitHub-community and keyless-search leads are collected
in [SIGNALS.md](SIGNALS.md). Their inclusion is not official confirmation.
This review does not claim to have independently verified every community post.

## Rumours — 疑似 / unverified

The current [SIGNALS.md](SIGNALS.md) includes explicitly labelled speculation.
No rumour is promoted to a confirmed model or product launch in this report.
Model names or dates mentioned by third parties require first-party evidence.

## Cross-check

- `releases.md` and `npm.md` already track `0.2.0-rc.2`: retained as version
  context, not falsely described as a new discovery.
- `product-news.md` records observations of the official Harness product page.
  This fills a source gap: desktop landing pages need not create a model-news slug.
- The September 10 V4.1-Flash model announcement is already tracked. No newer
  model announcement is claimed by this report.
- The repository scope now includes the Ascend repositories; a repeated request
  to add them would be stale. An initial commit and a GitHub Release object are
  different events and must not be assigned interchangeable dates.

## Risk / Confidence

High confidence in desktop download availability, the prerelease version status
and the quoted DeepGEMM initial-release date: these were checked against direct
first-party content. Media interpretations remain attributed. Search caches may
still show the older Harness developer-preview page; current official HTML takes
precedence. No original WeChat announcement or full X/Reddit timeline was verified
in this review, and no claim depends on those being accessible.

## Next steps

Keep checking the Harness product page, GitHub release metadata and npm separately.
Continue collecting media, community and rumours without waiting for a new model
announcement. Recheck each material claim before promoting it to the official record.

## Appendix — Sources fetched

- [direct HTML] https://www.deepseek.com/harness/
- [GitHub API] https://api.github.com/repos/deepseek-ai/deepseek-harness/releases
- [npm API] https://registry.npmjs.org/@deepseek-ai/dsh
- [GitHub API] https://api.github.com/repos/deepseek-ai/DeepGEMM-Ascend/commits
- [first-party README] https://raw.githubusercontent.com/deepseek-ai/DeepGEMM-Ascend/main/README.md
- [first-party README] https://raw.githubusercontent.com/deepseek-ai/DeepEP-Ascend/main/README.md
- [Exa fetch] https://eu.36kr.com/zh/p/4005355518726025
- [Exa fetch] https://www.infoq.cn/article/t5i2Yv2z0LwIbK36lteR
