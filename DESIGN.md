# DESIGN.md — the midnight transit enamel mural

<!-- impeccable:design-schema 1 -->

The visual world for `site/`, written from the built result. Read this before
extending the page: the diagram, the signals strip, and the source table all
derive from the same six rules below, and a new surface that breaks them reads
as a different product.

## The world

A wayfinding enamel panel, lit at night — the object a transit authority mounts
on a wall and expects a stranger to read without instruction. Six coloured
routes run across a dark ground. Stations are porcelain dots. Where routes meet,
they join at a porcelain interchange ring.

The page is not decorated as a map. **It is one.** Six official DeepSeek sources
are six lines, and a release that appears on several of them at once is a real
interchange in the data, not a metaphor applied afterwards. That mapping is the
thesis: the old list could not tell you that one release was corroborated and
the next was a lone npm bump, because both were rows.

## Tokens

All colour is oklch so the lightness steps stay even across hues — six lines
sit side by side and one must clearly lead.

| Token | Value | Role |
|---|---|---|
| `--enamel` | `oklch(23% 0.055 258)` | the panel. Blue-shifted, never black |
| `--enamel-deep` | `oklch(19% 0.05 258)` | recessed: footer, code surfaces |
| `--enamel-raised` | `oklch(27.5% 0.05 258)` | the station card, lifted one panel |
| `--porcelain` | `oklch(97.8% 0 0)` | station ticks, headings, interchanges |
| `--text` | `oklch(93% 0.032 250)` | body |
| `--text-muted` | `oklch(77% 0.03 252)` | supporting copy, route labels |
| `--text-faint` | `oklch(67% 0.032 252)` | dates and counts |
| `--rule` | `porcelain / 0.11` | hairline separators |
| `--rule-strong` | `porcelain / 0.2` | card and input edges |
| `--line-blog` | `oklch(74% 0.14 210)` | deepseek.com blog — trunk |
| `--line-api` | `oklch(62% 0.17 255)` | API changelog — trunk |
| `--line-github` | `oklch(76% 0.15 78)` | GitHub releases |
| `--line-hf` | `oklch(68% 0.12 172)` | HuggingFace |
| `--line-npm` | `oklch(62% 0.16 305)` | npm |
| `--line-news` | `oklch(70% 0.11 40)` | API news pages |
| `--signal` | `oklch(62% 0.045 60)` | unverified material only |
| `--focus-ring` | `oklch(80% 0.13 210)` | focus |

Secondary inks carry real chroma at the ground's hue. Grey text on a coloured
panel looks washed out; the tints are not decoration but the legibility rule.

### The line inks separate in lightness, not only hue

Scarlet (`--line-news`, L 70) against verdigris (`--line-hf`, L 68) is close
enough in lightness that a red-green deficiency would collapse them into one
another. The two trunnks are the brightest and the branch lines are dimmer, so
the diagram reads as a system with two main routes rather than six equal ones.

## Type

One face with two registers, loaded from Google Fonts.

- **Display and labels — Barlow Condensed.** Station names, route labels,
  headings, the wordmark. Condensed because wayfinding labels are narrow and
  dense, and because a transit diagram is mostly text at small sizes.
- **Body — Barlow.** Everything a sentence is made of.
- **Mono — JetBrains Mono.** Dates, versions, counts, `time` elements, and code.
  Strictly data and measurement. Never used as a "technical" costume.

Numerals are `tabular-nums` everywhere: a feed that updates every six hours
would otherwise jitter column-wise on every build.

## Rules

1. **The interchange ring is the only emphasis.** A 13px porcelain ring replaces
   the 7px filled dot when a release touched two or more sources. It is the one
   moment the page spends real visual weight, so it must stay rare. Shape and
   size carry the meaning, not colour alone.
2. **Unverified material never looks like a station.** Signals are flat hairline
   rows in a warm tint outside the line palette, stamped `unverified`. Never a
   card, never a ring, never a line colour. Provenance must be readable without
   reading a word.
3. **Hairlines are 1px.** The accent along the station card's top edge is a 1px
   gradient in its line's colour, never a 3-4px bar.
4. **No client-side JavaScript.** The page is one static document built from
   committed markdown. Motion is limited to 120ms colour transitions and the
   sticky masthead's blur.
5. **Titles stay verbatim.** The tracker copies official titles exactly. The page
   shows a deterministic trim (`prettyTitle`) and keeps the untouched string in
   each link's `title`. No model rewrites a title, here or upstream.
6. **Minimum functional text is 11px**, and most metadata sits at 12px. Release
   dates are the thing people actually scan for.

## Composition

The first viewport is the thesis, not a header. The claim heads the diagram's own
column; the featured station and the route roster sit beside it and stay sticky
as the reader descends the map. Grid areas let the narrow layout reorder to
claim → featured release → map, which matters because on a phone the diagram is
80 stops long and would otherwise push the newest release off the page.

## Verification

Both run against the built artifact and both are gates, not advisories:

- `node contrast.mjs` — converts the oklch tokens to sRGB and checks WCAG
  contrast on the enamel ground. Body and small text must clear 4.5:1. It
  caught `--text-faint` at 3.96:1, which is why the token sits at 67%.
- `impeccable detect` — reports 2 findings, both deliberate: `tight-leading`
  (the 2.45rem claim at 1.10; 1.3 would space a display line wrongly) and
  `all-caps-body` (tracked caps on nav and badges, which is the wayfinding
  convention this world is built on).

## Extending

New source? Add a `--line-*` ink and an entry in `LINES` (`site/src/lib/transit.mjs`).
The diagram, legend, route table, and totals all derive from that array — a
seventh line needs no new markup.

New section? Use `--enamel-raised` for a panel, `--rule` for separation, and
Barlow Condensed for its heading. If it needs a seventh accent colour, it is
probably not this page's job.
