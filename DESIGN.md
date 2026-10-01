# DESIGN.md — DeepSeek's own sky

<!-- impeccable:design-schema 1 -->

The visual world for `site/`, written from the built result. Read this before
extending the page.

## The world

**A celestial almanac, read at night.**

An astronomical almanac is the artifact that already means *a dated table of what
happens when, kept current, and trustworthy enough to navigate by.* DeepSeek ships
constantly and on a schedule; each release is a fixed point in time, recorded
once, in a column you scan down. The page is therefore an observation record, not
a blog roll, and it says so in its own language: entries are **observations**,
its freshness marker is an **observation epoch**, and the unverified material
below is called **conjectures** rather than posts.

This replaced two earlier worlds. The midnight transit diagram and then the
build-instruction sheet both put the same idea on screen — numbered steps on a
ruled grid — but rendered it in 11px hairlines, which made an 80-row record read
as a filing cabinet for a company that is currently the fastest-shipping lab in
AI. What survived both, and what this world keeps, is the one thing a flat
reverse-chronological feed cannot express: **a release that appears on several
sources is a genuinely different kind of event.**

## Tokens

DeepSeek's own published values, read from their CSS custom properties rather
than eyeballed from a screenshot — but the *role* each one plays is new:

| Token | Value | DeepSeek source | Role |
|---|---|---|---|
| `--sky` | `#0a1030` | derived from `--ds-color-brand` | the field — a night sky, not a panel |
| `--sky-deep` | `#060a20` | derived | footer plane |
| `--brand` | `#4d6bfe` | `--ds-color-brand` | the bright mark: transit marks, CTA hover |
| `--brand-deep` | `#3a65c2` | `--ds-color-brand-deep` | the CTA fill |
| `--brand-darker` | `#2f4fa3` | derived | the CTA hover state |
| `--brand-light` | `#73a3d2` | `--ds-color-brand-light-reverse` | column rules, versions, primary-entry rule |
| `--brand-pale` | `#a8c4ff` | derived | the brightest entries; magnitude at its brightest |
| `--text` | `oklch(97% 0.008 265)` | derived | body type |

The previous system spent the brand blue on 2px rules and 15px badges, so the one
colour DeepSeek owns never actually appeared as colour. Here the deepest brand
step is the ground and the brightest step is the light.

### Three tier hues, and why they exist

The signal register uses hue to carry meaning, which the official table never
does:

| Token | Value | Tier |
|---|---|---|
| `--tier-rumor` | `#f0b429` | rumour — speculation about unannounced work |
| `--tier-community` | `#4ec9e0` | community — leads, does not prove |
| `--tier-media` | `#9d8cff` | secondary — authoritative, not first-party |

None of them is the brand blue, so an unverified item can never be mistaken for
an official one. Rumour also gets a dashed rule and a dimmed link, so the
distinction survives greyscale and colour-blind readers.

## Type

- **Display and labels — Barlow Condensed.** Entry titles, section heads, the wordmark, the CTA.
- **Body — Barlow.**
- **Mono — JetBrains Mono.** Strictly data and measurement: dates, versions,
  magnitudes, step numbers, cadence ticks, counts, code. Never as costume.

`tabular-nums` is set on `time`, `.mono`, `.num` and `.mag`. This is not
optional: the table is scanned down a column and rebuilds every six hours, so
non-tabular figures make the whole page shift sideways twice a day.

The root is `1rem`, deliberately. A non-standard 17px base is a small convenience
that costs more than it buys — every unitless `line-height` in the cascade
resolves against it, so correct 1.3 leading measures as 1.22 and reads as a
defect. Generosity comes from the spacing scale, not from inflating the root.

## Rules

1. **The structure is ink.** No cards, no shadows, no rounded panels, no
   coloured `border-left` beyond the single 2px corroboration rule. An almanac
   page is a ruled table; anything that needs a container to hold it together is
   a layout bug, not a component.
2. **Column rules are real borders on the cells**, not a background of gradient
   hairlines behind the rows. The cells own their rules, so they stay correct
   when a row wraps, when the table reflows to one column, and when a row is
   missing entirely.
3. **Sources are numbered, never coloured.** Badge `01`–`06`, derived from
   `LINES`. Adding a source renumbers itself.
4. **Magnitude is data, not decoration.** The `.mag` column is an apparent
   magnitude computed from how many independent sources corroborated the release.
   Lower is brighter, on the real astronomical curve. Three tiers of weight carry
   it so rank reads without colour. Undated tags get **no** magnitude: they carry
   no position in time, so assigning them a brightness would assert something the
   data does not support.
5. **A corroborated entry takes a 2px brand rule** down its left edge — the same
   fact as its magnitude, expressed as weight.
6. **No client-side JavaScript.** One static document built from committed
   markdown. The transit strip is a CSS grid of marks; the folds are `<details>`.
7. **Minimum functional text is 11px** (`0.6875rem`). Below that the page is
   legible on a 27" monitor and useless on a phone.
8. **The horizon is explicit.** A 2px rule plus a register change separates
   observations from conjectures, before a word is read.

## The memorable moment

The **transit strip**. Sixteen weeks of shipping as a band of marks, each column
one week scaled to the busiest week on the page, with a short column for a quiet
week rather than a gap.

It exists because of a real failure this repo had: the tracker ran every six
hours for three weeks while its README headline sat on a single September
release, and the only honest reading was "this thing is dead." A band of marks
answers that with the shape of the cadence, without asking anyone to trust a
timestamp or read a log.

## Composition

The first viewport is the thesis, not a header. The almanac's own header line
names what is tracked and states it in the form's own vocabulary; the transit
strip sits directly beneath it; the featured observation and the source roster
sit beside them and stay sticky as the reader descends. Grid areas reorder the
narrow layout to claim → strip → featured observation → roster → table, which
matters because the table is 80 rows and would otherwise push tonight's entry off
a phone.

## Verification

All four run against the built artifact and all are gates:

- `node scripts/contrast.mjs` — reads the **built** CSS, so it cannot drift from
  what ships. Checks body type, muted, faint, both brand light steps, all three
  signal tiers, and white-on-CTA at rest *and* on hover. The tier hues are held
  to the full 4.5:1 body ratio rather than the 3:1 a decorative mark would get.
- `node site/src/lib/transit.test.mjs` — the data model against real committed
  markdown, including the CRLF fixture that once made every source file parse as
  empty, and the `🆕`-column fixture that once made every fresh signal row vanish.
- `node scripts/signals.test.mjs` — ordering, idempotence, syndicated-duplicate
  collapse, tier isolation, the rumour window, and markdown-injection safety.
- `impeccable detect` — currently clean on `site/src/styles/*.css`.

## Extending

New official source? Add an entry to `LINES` in `site/src/lib/transit.mjs`. The
roster, badges, totals, source table and every piece badge derive from it.

New signal tier? Add a hue to `tokens.css` and a row to the tier map in
`site/src/styles/page.css`. A new tier must not be the brand blue, and must carry
a non-colour cue too — a rule style or a dimmed link — so it survives greyscale.

New section? `--sky-raised` for a plane, `--rule` for separation, Barlow Condensed
for its heading, and no new hue. Three tier hues plus the brand is the whole
budget.