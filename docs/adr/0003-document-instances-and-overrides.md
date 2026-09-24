# ADR-0003: Materialised page instances referencing templates, with sparse overrides

Status: Proposed · Date: 2026-09-24

## Context
A 6-month planner has ~180 daily pages generated from one page template. Users must (a) edit all of
them at once, (b) occasionally tweak one page, (c) reorder/disable sections, and (d) regenerate after
changing dates without losing edits.

## Decision
- A project stores a **forked copy** of its template and content libraries.
- `generate()` produces a `PlannerDocument`: section tree of `PageInstance { key, templateId, context,
  enabled, overrides?, contentAssignments? }`. Keys are semantic (`m2/w3/d/2026-11-18`).
- Page numbers, sides and geometry are **derived**, never stored.
- Precedence: registry defaults → template → format override → side variant → instance override.
- Regeneration re-attaches overrides by key; orphans are shown to the user.

## Alternatives
- **Store only config, regenerate on load** — tiny documents, but per-page edits and structural
  reordering have nowhere to live.
- **Copy full pages on generation** — trivially editable, but "change the HALT scale on all daily
  pages" becomes 182 edits, and documents grow to many MB.
- **Reference library templates (no fork)** — template updates propagate, but edits in one project
  silently change another. Fork now; add versioned template upgrades later.

## Consequences
+ Template-level and page-level edits are both natural; documents stay < 1 MB.
− Needs an explicit "edit scope" UX and "reset to template" affordances.
− Key design must be stable; covered by golden tests.
