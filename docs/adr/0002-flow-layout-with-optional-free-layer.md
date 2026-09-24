# ADR-0002: Flow layout in mm with `fr` sizing; absolute positioning as opt-in layer

Status: Proposed · Date: 2026-09-24

## Context
Every template must render in A4 and A5 (A5 = 70.7 % linear scale) and in left/right variants. The
brief's `PlannerBlock` has optional `x, y, width, height`, suggesting Canva-style placement.

## Decision
Page bodies are a tree of `stack` / `row` / `block` nodes rendered with CSS Grid/Flex in physical `mm`.
Sizes are `mm | fr | auto`. A separate `free` layer supports absolute `x,y,w,h` for decorative or
bespoke elements. Blocks can be pinned to the side-aware **outer rail**.

## Alternatives
- **Absolute everywhere** — maximum freedom, but every page needs per-format and per-side coordinates;
  switching A4 → A5 would require manual re-layout of every template. Rejected as default.
- **HTML `<canvas>` / Konva** — great interaction, but print output becomes raster or needs a second
  vector renderer. Rejected.

## Consequences
+ A4/A5 and left/right are mostly free; "evening writing area fills the rest" is one `fr:1`.
+ Same DOM for editor and PDF (WYSIWYG).
− Editor must offer structured drag targets (insert between / into row) rather than pixel drops.
− Overflow must be detected by measuring the DOM and surfaced as warnings.
