# How tracking and review work

The tracker has separate collection, research, review and publishing stages.

- `track.yml`: every six hours, mirrors official release channels and checks
  `https://www.deepseek.com/harness/` directly. Product copy/headings/download
  links are fingerprinted, ignoring JavaScript bundle hashes. The first observed
  date is explicitly distinguished from an unknown publication date.
- `scripts/signals.mjs`: collects media/community/rumour leads without an LLM.
  Exa's hosted MCP, Firecrawl Keyless, HN, RSS, Chinese media and other public
  sources feed `SIGNALS.md`. Quota/network failures are recorded as coverage gaps.
  It owns `data/signals-seen.json`, not the discovery baseline.
- `discover.yml`: refreshes the CLI model registry and researches fresh signals with models whose input/output/cache prices are all zero and which support tools. Reasoning support, release date and context capacity rank candidates; real task output decides whether to keep the result. It opens
  or updates one `discover/insights` PR. Each attempt must produce a changed,
  sourced report. Errors, timeouts and missing artifacts trigger model fallback;
  total failure preserves the prior report and does not consume the baseline.
- `auto-review.yml`: runs after discovery and hourly to retry pending drafts.
  Code and agent instructions always come from main; only bot-authored,
  same-repository, `insights.md`-only PRs are eligible for automatic merging.
  Useful attributed community/media/rumour reporting is eligible without a new
  official announcement. A tool outage requests retry, not human editorial review.
  Source evidence, head SHA, build and tests are checked before the merge API is
  called. A failed merge fails the Action; no success comment is posted first.
  The base workflow first fetches a compact live evidence bundle from fixed
  official URLs, preserving desktop download links and release/npm metadata.
  This avoids repeated browser emulation and large package-history downloads;
  missing or contradictory evidence still requires source checks. The bundle
  and review decision are retained as Action artifacts. The final context check
  reads the live main Git ref, not the PR's potentially stale base SHA.
- After bot data commits or merges, Pages is explicitly dispatched, because
  pushes made using `GITHUB_TOKEN` do not trigger other push workflows.

## Keyless tools available to the repository agents

`opencode.json` uses the supported top-level `mcp` map:

| Tool | Endpoint | Purpose |
| --- | --- | --- |
| Exa MCP | `https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa` | Dated search, original articles, community leads |
| Firecrawl MCP | `https://mcp.firecrawl.dev/v2/mcp` | Keyless search/scrape; optional key only increases quota |
| Kitesurf via chrome-devtools-mcp | `wss://kitesurf.dev/devtools/browser` | Remote rendered browser for pages that need JavaScript |

Validate with `opencode debug config` and `opencode mcp list`. CI pins OpenCode
to the locally verified version. Free endpoints have quotas; successful
configuration does not guarantee model/service availability on every run.

## Validation

```sh
node --test scripts/*.test.mjs site/src/lib/*.test.mjs
node scripts/build-pages.mjs
node scripts/contrast.mjs
```

The website serves English at `/deepseek-official-tracker/` and Chinese at
`/deepseek-official-tracker/zh/`. Theme choices are System, Light and Dark.
Canonical/hreflang metadata, JSON-LD, sitemap and `llms.txt` expose the same
source boundaries to search engines and AI readers that the visible site uses.
