---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: [".impeccable/direction-contract.md"]
---

# Surface brief — GitHub Pages (site/index.html)

## Scope and visitor mode

Scope: the single public page served by GitHub Pages from `scripts/build-pages.mjs` output, plus `feed.json`. Read mode. The visitor arrives from the repo README, a GitHub Actions notification email, or a search result, and wants to answer one question: did DeepSeek ship anything official since I last looked, and where is the proof.

## Audience, job, action, proof, constraints

- **Audience:** DeepSeek API users and open-weights researchers as the confirmed core; people not yet paying attention to DeepSeek as the explicit growth goal.
- **Job:** scan what changed, judge whether it affects them, verify before acting.
- **Action:** open the source link. That is the only conversion that matters.
- **Proof:** every entry is a real first-party datum with a real `[Source]` deep-link. 80 real entries in `FEED.md`, 6 real sources, a real build timestamp, a real health report.
- **Constraints:** Node 22, Astro, static output, no client hydration. Content is English; docs are bilingual. Six official sources and unverified signals must be visibly separated, never blended.

## Chosen direction

**Wayfinding / cartography / signage — the midnight transit diagram.** Seed key `b19bf514`, scope `direction`, mode `read`. Won the roll's weighting against the assigned candidate on both axes.

## Memorable moment

The interchange circle. When one release appears on more than one line — V4.1-Flash hit the blog, the changelog, and HuggingFace the same day — those lines join at a single porcelain interchange node. The reader sees, spatially and instantly, that this release is corroborated across sources. This is the product's actual data structure, currently expressed nowhere on the page.

## Unresolved decisions

- Dark is committed (enamel mural at night, the wayfinding context where these diagrams are actually read). The health janitor and Actions logs are the light-surface siblings; no light theme ships in this pass.
- Whether the signal section is reachable in-page or lives only on GitHub is settled: in-page, below the official diagram, explicitly labeled.
