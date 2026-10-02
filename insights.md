# Insights — DeepSeek Deep Discovery — 2026-10-02

> Source-checked research snapshot as of 2026-10-02 UTC. Official evidence,
> media reports and unverified leads are separated below. No launch date is
> inferred from when this tracker first observed a page.

## Summary

DeepSeek has shipped more than model announcements. Its current Harness product
page provides Windows and macOS desktop downloads, and describes plugin-based
workflows and scheduled tasks, while still describing the desktop as a public
preview. The latest GitHub/CLI release checked remains
`dsh-v0.2.0-rc.2` from September 29, explicitly marked prerelease. Separately,
DeepGEMM-Ascend's first-party README dates its initial open-source release to
September 30. These product and infrastructure updates explain why the older
September 10 model headline was an incomplete view of what changed.

Community developers are also sharing browser integrations and local model
bridges. The attributed reports below are ecosystem leads, not official releases;
V4.1 Pro and V5 speculation remains unverified.

中文：新增消息包含 Harness 桌面端和昇腾基础设施，并不只有模型发布。桌面端官网已可下载，仍带预览版标注，CLI 当前版本也仍为候选版；官网观测日期不等于发布日。另保留社区工具与明确标注的模型传闻。

## New findings (verified only)

### Harness desktop — official page observed 2026-10-02

- The live official page is titled **DeepSeek Harness｜共探智能上限**, with the
  headline **DeepSeek Harness 现在，开箱即用**. It links to Windows x64 `.exe`
  and macOS arm64 `.dmg` installers on `download.deepseek.com`, and describes
  document work, spreadsheet analysis, coding, scheduled tasks and plugins.
  Its own wording includes **预览版 / public preview**. This confirms desktop
  availability, not a stable release; the page does not state a publication
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

- **Harness desktop hands-on** (2026-09-30, media report): 爱范儿's desktop hands-on report, republished
  by 36Kr, describes Windows/macOS installation, plugin management and scheduled
  automation. These are the outlet's reported experiences, not independent
  benchmarks by this tracker. Desktop download availability was separately
  confirmed on the official product page above.
  [Source](https://eu.36kr.com/zh/p/4005355518726025)
- **Ascend infrastructure overview** (2026-09-30, media report): InfoQ describes the Ascend infrastructure
  collection and differentiates the roles and limitations of TileLang,
  DeepGEMM, DeepEP, FlashMLA, TileKernels and DeepSelect. The broader six-component
  framing is attributed to InfoQ; only the first-party items actually checked
  above are presented here as independently verified findings.
  [Source](https://www.infoq.cn/article/t5i2Yv2z0LwIbK36lteR)

## Community signals

- **DeepDeck WebMCP browser** (2026-09-07, community report — unverified
  implementation claims): in Harness discussion #5856, author jo32 describes
  an **unofficial** desktop client that discovers website tools and builds
  reusable WebMCP operations. The source explicitly distinguishes it from the
  official desktop client. This review confirms what the post says, without
  installing the software or validating its performance claims.
  [Source](https://github.com/deepseek-ai/deepseek-harness/discussions/5856)
- **Modelbridge MCP plugin** (2026-09-13, community report — unverified
  implementation claims): a V2EX author shares a local MCP server that delegates
  tasks from ChatGPT to a local agent using an Anthropic-compatible endpoint,
  defaulting to DeepSeek. The post uses Claude Code as the agent harness; this
  is not an official DeepSeek Harness feature. The forum API confirms the post's
  text and timestamp, but the tracker has not tested the plugin.
  [Source](https://www.v2ex.com/t/1241664)
  [Source](https://www.v2ex.com/api/topics/show.json?id=1241664)

These are older community posts added to this research snapshot, not October 2
launches. More dated leads appear in [SIGNALS.md](SIGNALS.md).

## Rumours — 疑似 / unverified

- **疑似 / unverified V4.1 Pro and Harness joint launch** (2026-09-28,
  OrcaRouter article): the outlet quotes @teortaxesTex's conditional wish for
  DSH 0.2 and V4.1 Pro to ship together, explicitly describing it as a wish,
  not an announcement. The article's claim that no 0.2.x Harness version exists
  is now superseded by the official rc.2 evidence above; that change does not
  confirm the separate model rumour. Model confirmation would require a dated
  official announcement or first-party model card. No such confirmation is
  established by this report.
  [Source](https://www.orcarouter.ai/zh-CN/blog/dsh-0-2-v4-1-pro-leak)
- **疑似 / unverified V5 specifications** (2026-09-27, PromptBluePrints
  article): the outlet relays an X thread claiming a possible 2-trillion-parameter
  model trained on Huawei Ascend, while explicitly saying it supplies no firm
  release date, published weights, or performance evidence. These numbers and
  hardware claims remain speculation, not measured results. Confirmation would
  require an official model card or technical report; this review did not
  independently verify the original X thread.
  [Source](https://promptblueprints.tech/leaks/what-the-deepseek-v5-leak-actually-reports/)

No rumour is promoted to a confirmed model or product launch. Absence from a
third-party catalogue alone cannot establish whether a model exists.

## Cross-check

- `releases.md` and `npm.md` already track `0.2.0-rc.2`: retained as version
  context, not falsely described as a new discovery.
- `product-news.md` records observations of the official Harness product page.
  This fills a source gap: desktop landing pages need not create a model-news slug.
- The September 10 V4.1-Flash model announcement is already tracked. No newer
  model announcement is claimed by this report.
- A Hugging Face `lastModified` value alone says neither which files changed
  nor whether model weights changed. No weight-change conclusion is drawn here.
- The repository scope now includes the Ascend repositories; a repeated request
  to add them would be stale. An initial commit and a GitHub Release object are
  different events and must not be assigned interchangeable dates.

## Risk / Confidence

High confidence in desktop download availability, the prerelease version status
and the quoted DeepGEMM initial-release date: these were checked against direct
first-party content. Community posts and rumour articles were read directly to
verify attribution and dates; the underlying software and speculative claims
remain unverified. Media interpretations remain attributed. Search caches may
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
- [direct HTML] https://github.com/deepseek-ai/deepseek-harness/discussions/5856
- [forum API] https://www.v2ex.com/api/topics/show.json?id=1241664
- [direct HTML] https://www.orcarouter.ai/zh-CN/blog/dsh-0-2-v4-1-pro-leak
- [direct HTML] https://promptblueprints.tech/leaks/what-the-deepseek-v5-leak-actually-reports/
