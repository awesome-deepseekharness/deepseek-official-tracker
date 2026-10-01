# DESIGN.md — DeepSeek navy, white type, one brand blue

<!-- impeccable:design-schema 1 -->

The visual world for `site/`, written from the built result. Read this before
extending the page.

## The world

A build-instruction sheet for a product that ships in numbered steps. Every
official release is a step; the sources it appeared on are the numbered pieces
that step was assembled from. The columns are ruled like a stud grid, because a
tracker whose version column does not line up cannot be trusted to report
version numbers accurately.

The previous world was a midnight transit diagram. It worked, but the maintainer
asked for DeepSeek's own colours, and the roll was re-dealt. The idea that
survived from it is the one worth keeping: **a release that appears on several
sources is a genuine multi-line event**, and a flat reverse-chronological list
cannot express that. In this world it reads as a step with more than one piece.

## Tokens

DeepSeek's own published values, read from their CSS custom properties — not
eyeballed from a screenshot:

| Token | Value | DeepSeek source |
|---|---|---|
| `--navy` | `#121c31` | `--ds-color-text-primary-bluish` |
| `--navy-raised` | `#152443` | `--ds-color-text-primary-bluish` (alt) |
| `--brand` | `#4d6bfe` | `--ds-color-brand` |
| `--brand-deep` | `#3a65c2` | `--ds-color-brand-deep` |
| `--brand-light` | `#73a3d2` | `--ds-color-brand-light-reverse` |
| `--navy-deep` / `--navy-sunk` | `#0d1526` / `#182340` | derived, same hue |
| `--text` | `oklch(94% 0.012 255)` | derived, tinted at the ground's hue |

Type steps down from white rather than off to grey. Each step keeps chroma at
the ground's hue: neutral grey text on a navy panel looks washed out.

### The accent is used once

`#4d6bfe` marks the primary action, the step numbers, the call-out rule, and
hover underlines. It is **not** used to colour-code the six sources. Six
distinguishable hues would dilute the single colour the brand actually owns, and
on a navy ground six near-identical blues would be unreadable anyway. Sources are
identified by a **numbered badge** (01–06), which is exact rather than
approximate.

### The CTA does not use `--brand`

White on `#4d6bfe` measures **4.33:1**, under AA for 14px semibold text. The
button uses `--brand-deep` (5.50:1) and its hover darkens further to `#2f4fa3`
rather than lightening, because a hover state is a real state a reader lands on.
Both were caught by `scripts/contrast.mjs`, not by eye.

## Type

- **Display and labels — Barlow Condensed.** Step titles, source labels, headings, the wordmark.
- **Body — Barlow.**
- **Mono — JetBrains Mono.** Dates, versions, step numbers, counts, code. Strictly
  data and measurement, never a "technical" costume.

Numerals are `tabular-nums` throughout: the assembly is scanned down a column,
and a feed that rebuilds every six hours would otherwise jitter.

## Rules

1. **Sources are numbered, never coloured.** Badge numbers are the only
   identifier. Adding a source means adding an entry to `LINES` and the badge
   renumbers itself.
2. **A step with more than one piece was corroborated.** It gets a 2px brand
   rule down its left edge. That and the piece badges are the only emphasis —
   if everything is emphasised, nothing is.
3. **The version gets its own column** and is stripped from the step title, so
   it is never printed twice.
4. **Unverified material carries no number.** A numbered step is a fact DeepSeek
   published, so signals sit outside the system: flat hairline rows, warm
   neutral tint outside the navy/blue family, stamped `unverified`.
5. **Hairlines are 1px.** The call-out's brand mark is a 2px tab, not a thick bar.
6. **No client-side JavaScript.** One static document built from committed markdown.
7. **Minimum functional text is 11px**, most metadata at 12px.

## Composition

The first viewport is the thesis, not a header. The claim heads the step list's
own column; the featured release and the source roster sit beside it and stay
sticky as the reader descends. Grid areas reorder the narrow layout to
claim → featured release → roster → steps, which matters because the assembly is
80 entries long and would otherwise push the newest release off a phone.

## Verification

Both run against the built artifact and both are gates:

- `node scripts/contrast.mjs` — converts oklch and hex tokens to linear sRGB and
  checks WCAG on the navy ground, including the white-on-CTA pair specifically.
  It reads the built CSS, so it cannot drift from what ships.
- `node site/src/lib/transit.test.mjs` — the data model against real committed
  markdown. This is what caught the CRLF bug that made every source file parse
  as empty.
- `impeccable detect` — reports 2 findings, both deliberate: `tight-leading`
  (the 2.45rem claim at 1.10; 1.3 would space a display line wrongly) and
  `wide-tracking` (0.06em on 14px step titles, a condensed-face convention).

## Extending

New source? Add a `--line`-free entry to `LINES` in `site/src/lib/transit.mjs`.
The roster, badges, totals and source table all derive from that array.

New section? `--navy-raised` for a panel, `--rule` for separation, Barlow
Condensed for its heading, and do not introduce a seventh accent — the accent
budget is one colour and the call-out already spends it.
