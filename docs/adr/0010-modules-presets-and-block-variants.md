# ADR-0010: Modules, presets and block variants

Status: Accepted · Date: 2026-09-25

## Context
"Dzień po Dniu" started as a recovery planner. The content reviews (docs/roadmap.md) ask for the
same planner without addiction and therapy wording ("Balance"), and for optional parts such as a
weekly CBT page. Hiding blocks is not enough: many shared texts need neutral wording ("Dziś chronię
swoją trzeźwość przez:" → "Dziś dbam o siebie przez:"). The template already had section
conditions (`when`), block visibility rules and regeneration that keeps edits by page key
(ADR-0003); it had no named "module", no choice of one at creation, and no way to change a block's
text by condition.

## Decision
- **A module** is a named part of the planner a template declares (`template.modules`: id, name,
  description, default). **A preset** is a named set of module choices (`template.presets`), e.g.
  "Recovery Edition" and "Balance". A planner stores only its choices in
  `generation.modules`; a module it does not list takes the template's default, so planners made
  before modules existed print unchanged.
- **Conditions read `config.modules.<id>`.** `conditionConfig()` resolves every module to on/off
  before conditions are evaluated, in the generator and when pages are drawn, so pages and blocks
  agree. Templates test "on" as `!= false` (`moduleOn`), so a missing choice never hides content.
- **Pages and sections** are included by `when` (a page reference can now carry one as well as a
  section). Changing modules regenerates the planner; edits stay on pages that still exist.
- **Blocks** are hidden by `visibility`, and reworded by **variants**: `block.variants` is a list of
  `{ when, props?, style? }`; the first whose condition holds is merged over the block. Precedence,
  low → high: template block → format adjustment → variant → side → the page's own change.
  Variants live inside the block, so they survive moving it in the designer (A5 adjustments, by
  contrast, point at blocks by position). The condition scope also has `format`, so a variant can
  target one format (the Balance check-in on two lines in A5).
- **Examples follow the modules too.** A page's example filling (`sampleContent`, keyed by block)
  can have `sampleVariants: { when, content }[]`; the first match replaces the examples of the
  blocks it lists, when the page is resolved. The bundled template uses one for planners without
  the recovery module (Basic, Balance): swimming and a book club instead of meetings and therapy.
- **The designer edits what it shows.** A template-scope edit of a value the active variant sets
  changes that variant, and the inspector marks its origin "module"; otherwise the block changes as
  before. Editing Balance wording never touches the hidden recovery wording, and the reverse.
- **Choosing**: the new-planner form has an edition (preset) and a module list; the preview's
  planner settings offer the same and regenerate. A choice that matches no preset shows as
  "Custom". The structure recipe stays for finer control within a module.
- The bundled template has three modules: `recovery` (sobriety counter, craving, triggers, AA and
  group markers, contract and safety rules, crisis section, recovery wording), `halt` (HALT-B on
  the day page and in "My week") and `cbt` (the weekly situation analysis, previously a structure
  switch). A test renders every Balance page in both languages and formats and fails on recovery
  or therapy words.

## Consequences
- Wording for a module is written next to the base wording, in the template source; a Balance
  planner is the same template, not a copy.
- Pages whose blocks depend only on modules or the format still share one resolved template;
  only rules that read the page or its variables resolve per page.
- The quote library and the guide booklet are not per module yet (the guide shows the recovery
  edition with every module on).
- Variants are not editable as such in the designer (only through "edit what you see"); a future
  module editor can add that.
