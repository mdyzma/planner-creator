# ADR-0009: Editor commands, edit scope and the structure recipe

Status: Accepted · Date: 2026-09-24

## Context
The designer (M6) edits one planner of ~470 pages that come from ~19 page templates. Users need to
(a) change every daily page at once, (b) tweak one page, (c) add, move, resize, lock and delete
blocks, (d) switch sections on and off and reorder them, and (e) undo all of it. The A5 layout is
stored as JSON-patch adjustments that point at blocks by position, and generated pages are
regenerated when dates change (ADR-0003).

## Decision
- **Commands are pure functions** in `@planner/editor` (`setBlockValue`, `addBlock`, `moveBlock`,
  `setRecipeChildEnabled` …): project in, project out. The web app's Zustand store is the only
  caller, which gives undo, autosave and dirty tracking one choke point.
- **Undo keeps immutable snapshots** rather than immer patches (§9.2). Commands never mutate, so
  snapshots share everything they did not change; 200 steps are kept. Edits with the same merge
  key within 1.5 s (typing, dragging a resize handle) form one step.
- **Edit scope** is "all pages using this template" (default) or "only this page". Only-this-page
  edits are sparse `BlockPatch`es on the page instance: property values, style values, or hidden.
  Structure (add, move, delete, size, lock) always changes the template, because a patch cannot
  express it; in page scope, delete means "hide on this page".
- **Format adjustments follow their blocks.** Every structural edit re-points A5 operations to where
  their block now is and drops those of deleted blocks. Editing a value the current format adjusts
  (e.g. the A5 number of sub-lines) changes the adjustment, so the other format keeps its value.
- **Structure is edited in the recipe.** Switching a section or page on or off, or reordering it,
  changes the template's section tree (`enabled: false` on a section or page reference) and
  regenerates; edits stay on pages whose keys still exist. Repeated page references are counted
  before switched-off ones are skipped, so the remaining pages keep their keys.
- Switching a single generated section or page off is stored on the document and carried over by
  key, as before.

## Alternatives
- **immer patches for undo** — smaller history entries, but needs immer everywhere and inverse
  patches for every command; snapshots are simpler and cheap with structural sharing.
- **Reordering the generated document** — immediate, but lost on the next regeneration and
  inconsistent between months.
- **Detaching a page into its own template** for page-only structure edits — possible later; not
  needed for the brief's acceptance criteria.

## Consequences
+ The template stays the single source of each page's layout; page edits are small and visible
  (marker, "reset this page").
+ A5 and A4 can be tuned independently without the adjustments drifting onto the wrong block.
− Switching a page off inside a month that occupies whole sheets may leave the page count
  unchanged: the page becomes a blank filler page.
− A structure change regenerates the planner (a few tens of milliseconds for six months).
