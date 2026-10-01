---
version: 1
slug: "site-index-html"
primary_target: "site/src/pages/index.astro"
related_targets: [".impeccable/direction-contract.md"]
---

# Surface brief — GitHub Pages (site/src/pages/index.astro)

## Scope and visitor mode

Scope: the single public page served by GitHub Pages from `scripts/build-pages.mjs`, plus `feed.json`. Read mode. The visitor arrives from the repo README, a GitHub Actions notification email, or a search result, and wants to answer one question: did DeepSeek ship anything official since I last looked, and where is the proof.

## Audience, job, action, proof, constraints

- **Audience:** DeepSeek API users and open-weights researchers as the confirmed core; people not yet paying attention to DeepSeek as the explicit growth goal.
- **Job:** scan what changed, judge whether it affects them, verify before acting.
- **Action:** open the source link. That is the only conversion that matters.
- **Proof:** every entry is a real first-party datum with a real `[Source]` deep-link. 80 real entries in `FEED.md`, 6 real sources, a real build timestamp, a real health report, and a real `SIGNALS.md` tier table.
- **Constraints:** Node 22, Astro, static output, no client hydration. Content is English; docs are bilingual. Six official sources and unverified signals must be visibly separated, never blended.

## Chosen direction

**Celestial almanac / navigation table — DeepSeek's own sky.** Seed `8dd7a56d`, scope `direction`, mode `read`, assigned index 4. The roll refused the incumbent's own metaphor and the transit-diagram family entirely.

Candidate 4 of the grounded list: an **astronomical almanac and its printed navigation table** — the book a mariner or an astronomer keeps by the desk to know what is happening in the sky tonight and when. DeepSeek ships constantly and on a schedule; an almanac is the cultural artifact that already means "a table of what happens when, kept current, with every entry dated and located."

## Direction contract

THESIS: An almanac already means "a dated table of what happens when, kept current, and trustworthy enough to navigate by." DeepSeek ships like bodies transit a meridian — each release a fixed point in time, recorded once, in a column you scan down. The category default this refuses is the reverse-chronological card feed: equally-weighted rows where a model launch and an npm patch bump look identical, and where nothing tells you whether the tracker is alive.

OWN-WORLD: DeepSeek's published brand blue as a full-bleed night field, not a hairline accent — the sky the almanac is read against. Bone-white tabular type, the way an almanac's numbers are set. Rules and hairlines carry the whole structure; there are no cards, no shadows, no rounded panels. One rule weight separates a star from a footnote. Data is set in mono and is never costume: dates, versions, counts, coordinates. Almanac register throughout — an entry is an *observation*, not a *post*.

STORY: The visitor reads the newest release as tonight's primary entry, sees the almanac's standing columns (date, object, magnitude, coordinates/where to observe it), and opens the source. A release corroborated by several sources reads brighter in the same way a first-magnitude object outshines a fifth-magnitude one — magnitude is not decoration here, it is the actual corroboration count. Unverified material sits below the horizon line in a separate register: the almanac's conjectural notes, dated and attributed, never numbered as observations.

FIRST VIEWPORT: The claim is the almanac's own header — the edition line naming the tracked body and the observation date, set large, flush left, ruled beneath. Directly under it, step 01 as the primary observation: its date on the ruled date column, its title at display scale, its magnitude badge (source count) and its source badges inline, and the single primary action opening the source. The source roster sits beside it and stays sticky as the reader descends. Above the entry list, a full-width transit strip: the last several weeks as a band of dated marks, so "is this tracker alive" is answerable in one glance from the shape of the band rather than by reading a timestamp.

FORM: Ephemeral navigation table / printed almanac page. Position on the ordered grounded list: 4th of 7 by resonance. Seed key `8dd7a56d`.

## Memorable moment

The magnitude column. Each official release carries a real, computed magnitude derived from how many independent sources corroborate it — one source is faint, three sources is the brightest thing on the page. The number is not a badge or a flourish; it is the product's actual data structure, the thing a flat feed cannot express, rendered as the one field an almanac reader already knows how to judge at a glance.

## Unresolved decisions

- Dark is committed, and now for a specific physical reason rather than atmosphere: an almanac for night observation, read against a night sky, is a dark-surface artifact. DeepSeek's own `--ds-color-brand` `#4d6bfe` becomes the field.
- The signal register is settled: in-page, below the official table, on the far side of an explicit horizon rule, and no row in it carries a step number.
- Build path is code-led. Image generation is not enabled in this environment, and no comp exists for this surface.

---

*unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.*