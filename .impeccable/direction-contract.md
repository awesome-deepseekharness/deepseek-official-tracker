# Direction contract

**Supersedes the first contract (seed b19bf514).** Re-rolled at the maintainer's
request after the colour direction was pinned to DeepSeek's own brand tokens.
New seed: `ebf5cce5`, scope `direction`, mode `read`.

Pinned by the maintainer, and it outranks the roll: **deep navy ground, white
type, DeepSeek blue as the accent.** These come from DeepSeek's own published
CSS, not approximation — `--ds-color-brand #4d6bfe`, `--ds-color-text-primary
#1e232c`, `--ds-color-text-primary-bluish #121c31`, `--ds-color-brand-deep
#3a65c2`, `--ds-color-brand-light #73a3d2`, `--ds-btn-primary-bg #fff`.

THESIS: A release tracker is a set of build instructions, not a feed. Every
official release is a numbered step; the sources it appeared on are the numbered
pieces of that step; and a page whose grid does not rule its own columns cannot
be trusted to report version numbers accurately. The category default this
refuses — a reverse-chronological list of equally-weighted rows — is what a
tracker falls back into when it has no opinion about what makes a release
different from a version bump.

OWN-WORLD: DeepSeek's navy `#121c31` as the ground, white as the type, and
`#4d6bfe` as the single saturated accent — the brand blue carried over from the
inbox paper, never restated per line. Sources are identified by a **numbered
badge**, not by hue: six same-family inks would be indistinguishable, and six
competing hues would dilute the one colour the brand actually owns. The studs
that rule the grid are `#73a3d2` at 1px. A call-out is a cornered frame with no
fill and a 1px `#4d6bfe` rule, the way a printed parts list frames a 1:1
reference. Type is Barlow Condensed for step titles and numbers, Barlow for
prose, JetBrains Mono for versions and dates — monospace reserved strictly for
data, never as costume.

STORY: The visitor reads the newest release as step 01, sees which numbered
pieces it was assembled from, and opens the source. A release corroborated by
several sources shows more pieces under its step. Older steps descend, ruled by
the same stud grid, so version numbers line up column-wise down the page.
Unverified material sits below the assembly, outside the numbered system
entirely — a numbered step is a fact DeepSeek published.

FIRST VIEWPORT: Deep navy panel. Left two-thirds: the claim, then step 01 and
step 02 with their stud grid already ruling beneath. Right third: the featured
release as a cornered call-out — its version in mono, its title, its numbered
source badges, and the single primary action opening the source. The masthead
carries the wordmark and the build timestamp in mono.

FORM: Brick build-instruction book — numbered exploded steps, a stud grid ruling
every alignment, 1:1 call-outs in cornered frames, wordless reference arrows.
Assigned candidate 5 of the re-rolled hand, seed `ebf5cce5`.

RAISES: From the cutting-bench challenger, declined but kept — state is a mark,
not a hue, and anything set aside stays reachable below the rail rather than
being deleted. From the modular-identity challenger, declined but kept — the real
datum snaps into the module instead of floating beside it, so a release and its
provenance share one alignment.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
