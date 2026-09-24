# Planner Designer — System Design

Status: **Proposed (rev. 4)** · Date: 2026-09-24 · Scope: MVP + extension points

This document turns the product brief ("Modern Bilingual Therapeutic Planner Designer") into an
architecture. Short decision records live in [`docs/adr/`](../adr/). It incorporates the product
decisions in §2.1 and a review of the reference demo, now frozen in
[`docs/reference/planner-demo/`](../reference/planner-demo/) (§2.2).

### Changes in rev. 4
- **Daily quotes:** a different printed quote on each daily spread. The corpus target is ≥ 60 en/pl
  quotes (182 for zero repeats) (§4.5.1).
- **Start date chosen in the creator:** day, month and year are picked in the wizard, and any weekday
  or mid-month start is supported. Month blocks follow calendar months (§12).
- **Hosting on Cloudflare**, run by the project owner: static web app on Workers Static Assets, PDF
  export on a Worker using **Browser Run** (Cloudflare's hosted headless Chromium), domain via
  Cloudflare Registrar/DNS, and GitHub Actions CI/CD with per-PR preview deployments. The local dev
  server keeps using Playwright (§10.4, §10.5, ADR-0008).
- PDF rendering is split **per section**. The browser merges the sections and applies imposition, so
  the server side stays small and stateless.

### Changes in rev. 3
- **The output is a blank planner filled in by hand.** Nothing is filled in online. Personal-data
  storage and the interactive Wheel of Life are removed from the MVP (§2.1, §10.2). Hosted privacy
  duties shrink to "design data only".
- **Ring binding** for both A4 and A5 (§8.4, ADR-0006): hole-punch zone in the binding margin,
  **sheet-aligned sections** so months can be printed and added to the binder one at a time, and A5
  printed 2-up on A4 with cut-and-stack ordering. Sewn booklets moved to "later".
- Quote cadence (`daily | weekly | none`) added, because a printed quote needs pre-written content (§4.5.1).
- The daily spread is **reversed from the demo**: Morning & Day on the left page, Evening on the right (§5.3).

### Changes in rev. 2
- Default density set to **one two-page spread per day**, as in the demo (~474 pages for 6 months).
  An optional split into two volumes is added (§2, F1).
- Print target is **the user's own printer**. Default profile has no bleed or crop marks, a printer-safe
  margin and duplex hints. **Imposition** added (A5 2-up on A4, folded booklet signatures for home
  sewing). CMYK/PDF-X dropped (§8.4, ADR-0006).
- **Local and hosted** deployment from one build (§10.4, ADR-0007).
- Content authoring pipeline for a curated bilingual quote corpus, plus an assignment generator (§4.5.1).
- Lessons from the demo: spread-split blocks, per-page design rationale, sample-fill preview, no emoji
  in print, no colour-only HALT coding (§2.2).

---

## 1. Requirements

### 1.1 Functional (condensed)

| Area | Must do |
|---|---|
| Projects | Create / duplicate / delete / reopen; autosave; versions; JSON import/export |
| Templates | Data-defined planners (therapeutic 6-month is template #1, not code) |
| Generation | Config (`template, format, locale, startDate, durationMonths, …`) → editable page tree; 4 vs 5 weeks per month; blank-page insertion so spreads land correctly |
| Editor | 3-panel designer: structure/palette · physical page canvas · property inspector; select, resize, reorder, duplicate, lock, delete blocks |
| Layout | A4 (210×297) & A5 (148×210) portrait; mirrored inner/outer margins; outer-margin rail; bleed; side-aware (`page.side`) styles |
| i18n | UI in en/pl; every content string `LocalizedText`; side-by-side editing, copy-across, missing-translation report; preview in either language |
| Content | Libraries for quotes, affirmations, prompts, SOS steps, warning-sign examples, exercises; tagged/categorised/filterable |
| Variables | `{{patientName}}`, `{{sobrietyDayNumber}}`, `{{dayName}}` …; all optional; anonymous planners must work |
| Export | Vector PDF at true physical size, embedded fonts, page numbers, bleed, crop marks, grayscale/colour; pluggable exporters (PNG/SVG/DOCX/JSON later) |

### 1.2 Non-functional

| Concern | Target |
|---|---|
| Users / scale | Single author, single device, local-first. Runs locally or hosted; hosted has no server-side storage in MVP |
| Document size | up to ~500 pages per planner (474 default); project JSON < 1 MB (pages are references + overrides, not copies) |
| Editor responsiveness | Page switch < 50 ms; block edit → repaint < 16 ms; full regeneration < 200 ms |
| Export | 500-page A4 PDF < 90 s on a laptop, with progress reporting; output page box exact to 0.01 mm |
| Print fidelity | Vector text & rules; hairlines ≥ 0.3 pt; legible in pure grayscale |
| Privacy | Zero analytics/telemetry; no cloud sync; personal data optional and isolated |
| Accessibility | WCAG 2.2 AA for the editor UI; state never conveyed by colour alone |
| Longevity | Every persisted document carries `schemaVersion` and migrates forward |

### 1.3 Constraints & assumptions

- Stack as preferred: Next.js (App Router) · React · TypeScript · Tailwind · shadcn/ui · Zustand · Zod · dnd-kit.
- Small team (1–3 devs) → favour boring, few moving parts; monorepo with pnpm workspaces + Turborepo.
- Assumed deployment: runs locally (`pnpm dev`) or as a self-hosted container. PDF export needs a
  headless Chromium somewhere (see §8), which is the **only** server-side component.
- Quotes shipped with the product are original or public-domain only (licensing, §10).

---

## 2. Key findings that shape the design

**F1 — The 190–200 page target can't hold a dated daily page for every day.**
Six months from 2026-10-01 is 182 days. With the chosen two-page daily spread, the dated planner comes
out at ~474 pages:

| Part | Pages |
|---|---|
| Introduction / contract / safety / how-to | 8 |
| Monthly opening spreads (6 × 2) | 12 |
| Weekly spreads (27 weeks × 2) | 54 |
| Daily spreads (182 × 2) | 364 |
| Wheel of Life + Monthly review (6 × 2) | 12 |
| Free notes (6 × 2) | 12 |
| Crisis section | 12 |
| **Total (before alignment blanks)** | **474** |

Density levers (days are grouped within their week, 27 weeks for this range):

| Configuration | Daily | Weekly | Total |
|---|---|---|---|
| **1 day/spread (2 pages), 2-page weekly spread: default** | 364 | 54 | **474** |
| 1 day/page, 2-page weekly spread | 182 | 54 | **292** |
| 2 days/page, 2-page weekly spread | 104 | 54 | **214** |
| 2 days/page, 1-page weekly | 104 | 27 | **187** |

**Decision: each day is a two-page spread, as in the demo (`dailyLayout: 'spread'`, 474 pages + a few
alignment blanks).** The denser layouts stay available (`'one-per-page' | 'two-per-page'`,
`weeklyLayout: 'spread' | 'single'`), and the wizard shows a live **page budget**.

Consequences of the spread default:
- **Physical size:** 474 pages = 237 duplex sheets, ≈ 24–26 mm spine on 90 g/m² paper (≈ 2.5 kg of
  A4 paper per planner). That is at the upper limit for home sewing and ring binders, so the generator
  offers **`volumes: 1 | 2 | 6`**. `2` splits after month 3 (≈ 240 pages each). Each volume repeats
  the intro's how-to page and the crisis section, so the safety pages are always in the volume being
  used. `6` gives one booklet per month (~75 pages).
- **Alignment:** a daily spread must start on a **left** page so both halves face each other. Every
  repeating unit (monthly, weekly, daily, month-end) is an even-length spread starting left, so after
  one filler following the intro, the rest of the planner needs no more blanks.
- **Export load:** doubles to ~500 pages per planner (§1.2, §10.4). The quote corpus is unaffected
  (still 182 daily slots).

**F2 — Generated pages must be editable *and* regenerable.** Users edit 182 daily pages mostly
*as one* (template-level edits) and occasionally *one at a time* (instance overrides). The document
model is therefore "materialised instances that reference templates + sparse overrides", keyed by
stable semantic keys so regeneration can re-attach overrides (§4.4, ADR-0003).

**F3 — Absolute (Canva-style) positioning breaks A4 ↔ A5 switching.** A5 is 70.7 % of A4 linearly;
absolute mm coordinates would have to be re-authored per format. A **flow layout with `fr` heights**
(e.g. the evening writing area "fills remaining space") reflows automatically. Freeform absolute
placement stays available as an opt-in layer (§5, ADR-0002).

**F4 — Chromium print-to-PDF gives vector output and true page sizes, but is RGB-only and cannot
emit PDF/X.** That doesn't matter now that the target is home printers (§2.1), which take RGB PDFs.
The risk on home printers is different: the print dialog's **"fit to page" scaling** and **duplex
misalignment**. The exporter handles both (§8.4).

**F5 — Polish needs more than string swaps.** Month names need nominative vs genitive forms
("październik" vs "1 października"), and gendered forms ("wdzięczny / wdzięczna") need a project-level
setting. Handled in `planner-i18n` (§7).

### 2.1 Product decisions (2026-09-24)

| Question | Decision | Design impact |
|---|---|---|
| Default density | 1 two-page spread per day (as demo) | ~474 pages; `volumes` option; daily spread starts left (§5.3) |
| Week ownership | Monday rule | Confirmed §12; `iso-thursday` kept as an option only |
| Print target | User's own hardware | "Home" print profile, imposition, duplex aids; no CMYK/PDF-X (§8.4) |
| Binding | A4 and A5 both **ring-bound** | Hole-punch zone, sheet-aligned sections, per-month printing, A5 2-up cut-and-stack (§8.4) |
| Quotes | **Daily**, a different quote per daily spread | Corpus ≥ 60 (≤ 3 repeats), 182 ideal; assignment generator reports repeats (§4.5.1) |
| Dates | **Chosen in the creator** (day / month / year) | Wizard date picker; any start weekday; calendar-month blocks with partial first/last month (§12) |
| Hosting | Run by the owner; **dev server + CI/CD to Cloudflare** | Static assets + export Worker on Browser Run; Registrar/DNS; GitHub Actions (§10.4–10.5, ADR-0008) |
| Filling | **Blank template, filled in by hand** after printing | No in-app data entry. Personal variables default to blank lines; personal-data store deferred; privacy scope reduced (§10.2) |
| Deployment | Local **and** hosted | Same build, two env profiles; hosted adds privacy notice and export-worker limits (§10.4) |
| Quotes | Author-written or curated bilingual list | Authoring pipeline and assignment generator (§4.5.1) |

### 2.2 What the demo teaches (reuse / avoid)

The demo (`index.html` + `app.js` + `styles.css`, ~3.9 k lines, Polish only, A4 only) is a static
mock-up of eight views with a "binding margins" toggle, a spread/single toggle, a quote rotator, an
interactive Wheel of Life and a "fill with sample patient data" button.

**Keep and generalise:**

| Demo idea | Becomes |
|---|---|
| Weekly goals on the **outer** edge of each page; weekly wins on the right page's outer edge | `outerRail` blocks with `sideVariants` (§5.1) |
| Monthly calendar **split across the spread** (Mon–Thu left, Fri–Sun right) | **Spread-split blocks**: one block instance rendered as slices on both pages (§5.4) |
| Priorities with 3 lines each: goal, plan, safeguard ("bezpiecznik") | `numbered-list` with `subLines: [{label}]` |
| Schedule 07:00–18:00 with **2 lines per hour** | `time-grid` with `linesPerSlot` |
| Per-day sobriety counter on the weekly spread ("Dzień 43") | `{{sobrietyDayNumber}}` evaluated with the day-strip's own date |
| "High-risk day" marking (Friday) | a `risk` marker in the `day-strip` marker set (shape + label) |
| "Three signals rule", "safe emergency meetings", "function of the substance → healthy alternative" | Content items and presets in the therapeutic template. They confirm that quadrant headings must be editable |
| Wheel of Life page paired with the month review (wins / hardest moment / next focus) | The default month-end spread pairs `wheel-of-life` with `monthly-review` (startOn left) |
| Rationale bar explaining *why* each page looks as it does | `PageTemplate.rationale: LocalizedText`, shown in the designer as guidance, never printed |
| "Fill sample data" / "clean template" | Optional, low priority: a **handwriting-sample preview** (`sampleContent`) that shows the designer how full a page gets. Preview only, never exported. The product itself only produces blank pages |
| Interactive Wheel of Life sliders | **Dropped.** The printed wheel is blank, for colouring by hand |
| Warm paper palette (`#fdfbf7` paper, `#1e2424` ink, `#c5beb1` dots) on a calm dark chrome | Seed for the print theme tokens (validated for grayscale, §8.2) |
| Margin overlay labelled "STREFA SZYCIA" | Canvas binding-zone overlay (§9.3) |

**Avoid:**
- Hard-coded Polish strings and hard-coded A4 (`210mm`, `22mm` gutter) across HTML/CSS/`@media print`.
  These are replaced by `LocalizedText`, the format registry and `resolveFrame()`.
- Print CSS that fights the screen CSS with `!important` padding (the print gutter is 22 mm; the brief says 15–20).
  In the new design one renderer uses the same geometry for screen and print.
- **Emoji as icons** (🌱 ⚖️ 🚨) on printed pages: they rasterise, font coverage varies, and they look
  inconsistent in grayscale. Use a bundled SVG icon set (Lucide) instead.
- HALT categories told apart **by colour only** (amber/red/blue/violet). Keep the H/A/L/T letter
  badges as the primary cue.
- `<input>`/`<textarea>` fields inside the printable page. They mix up *designing* a planner and
  *filling it in*. Printed fields are drawn as lines/dots; editing happens in the inspector.
- Quotes stored as code (`QUOTES_DATABASE`) with attributed passages from copyrighted works (AA Big
  Book, Frankl, Brown, Linehan, Rogers, Hemphill). None of these ship in the public template (§4.5.1).
- `innerHTML` built from strings (XSS risk once content becomes user-editable). Render everything through React.

---

## 3. High-level architecture

```text
┌──────────────────────────────── apps/web (Next.js, client-heavy) ───────────────────────────────┐
│                                                                                                  │
│  Dashboard      New-Planner Wizard      Designer (3-panel)        Preview        Export dialog   │
│      │                  │                     │                      │                 │         │
│      └──────────────┬───┴─────────────────────┴──────────────────────┴─────────────────┘         │
│                     ▼                                                                             │
│          ┌─────────────────────┐    commands    ┌────────────────────┐                            │
│          │  Editor state        │──────────────▶│  Document store     │── debounced ──▶ Repository │
│          │  (Zustand: selection,│               │  (Zustand + immer   │    autosave     (IndexedDB)│
│          │  zoom, view, panels) │◀──── derive ──│  patches, undo/redo)│                            │
│          └─────────────────────┘                └─────────┬──────────┘                            │
│                                                           │ PlannerProject                        │
└───────────────────────────────────────────────────────────┼──────────────────────────────────────┘
                                                            ▼
  packages/ (framework-agnostic TS, except renderer)                                       
  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐
  │planner-schema│◀─│planner-core    │◀─│planner-      │  │planner-renderer│  │planner-pdf        │
  │ Zod schemas, │  │ block registry,│  │generator     │  │ React DOM in mm│  │ PdfExporter        │
  │ types,       │  │ pagination,    │  │ template+cfg │  │ PageView, Block│  │ adapters:          │
  │ migrations   │  │ layout resolve,│  │ → page tree  │  │ renderers,     │  │  • Playwright      │
  └──────────────┘  │ overrides,     │  └──────────────┘  │ print CSS      │  │  • browser print   │
  ┌──────────────┐  │ visibility,    │  ┌──────────────┐  └───────▲────────┘  └────────┬─────────┘
  │planner-i18n  │◀─│ variables      │  │planner-      │          │                    │
  │ LocalizedText│  └────────────────┘  │content       │          │ same components    │ loads /print route
  │ Intl helpers │                      │ libraries,   │          │                    ▼
  └──────────────┘                      │ selection    │   ┌──────┴─────────────────────────────┐
                                        └──────────────┘   │ export-worker (Node + Playwright)   │
  templates/therapeutic-recovery/  ← pure data (JSON)      │ POST project JSON → PDF bytes;      │
                                                           │ stateless, never persists input     │
                                                           └─────────────────────────────────────┘
```

**Dependency rule:** arrows point *inward*. `planner-schema` depends on nothing; `planner-core` on
schema + i18n; generator on core + content; renderer on core; apps on everything. Nothing in
`packages/` imports from `templates/` — templates are loaded as data at runtime. This is what
guarantees "a completely different planner without changing the rendering engine".

### 3.1 Processing pipeline

```text
 PlannerTemplate ─┐
 ContentLibraries ┼─▶ generate() ─▶ PlannerDocument ─▶ paginate() ─▶ PhysicalPage[] ─▶ resolve() ─▶ ResolvedPage ─▶ render
 GenerationConfig ┘   (pure,         (section tree of    (adds blank      (side, number,    (merge overrides,  (React DOM,
                       deterministic) PageInstances,      fillers, pads    spread partner)   visibility, vars,  mm units)
                                      stored & edited)    signatures)                        margins→geometry)
```

Only `PlannerDocument` is persisted. Everything to its right is **derived** on demand and memoised
per page, so reordering a section instantly renumbers pages and flips sides everywhere after it.

---

## 4. Data model (`packages/planner-schema`)

All shapes are Zod schemas; TS types are `z.infer`. Units are **millimetres** unless stated.

### 4.1 Primitives

```ts
type Locale = 'en' | 'pl';                         // extensible list in one place
type LocalizedText = Partial<Record<Locale, string>>; // missing key = untranslated (reported, not crashing)
type FormatId = 'A4' | 'A5';                        // registry: { A4: {w:210,h:297}, A5: {w:148,h:210} }
type Side = 'left' | 'right';                       // verso | recto
type Length = { mm: number } | { fr: number } | 'auto';
```

### 4.2 Template (what a planner *can* be)

```ts
interface PlannerTemplate {
  id: string; version: string; schemaVersion: number;
  name: LocalizedText; description: LocalizedText;
  supportedFormats: FormatId[];
  supportedLocales: Locale[];
  defaults: { print: PrintSettings; theme: ThemeTokens; generation: Partial<GenerationConfig> };
  pageTemplates: Record<string, PageTemplate>;
  sections: SectionTemplate[];                      // ordered structure with repeaters
  variables: VariableDefinition[];                  // declared, typed, all optional
  contentLibraryRefs: string[];                     // which libraries it expects
}

interface SectionTemplate {
  id: string; title: LocalizedText;
  repeat?: RepeatSpec;                              // e.g. { over: 'months' } → nested { over: 'weeksOfMonth' }
  startOn?: Side | 'any';                           // generator inserts a blank page if needed
  optional?: boolean;                               // user can disable in wizard/structure panel
  when?: Condition;                                 // e.g. only if config.dailyLayout === 'two-per-page'
  children: Array<SectionTemplate | { page: string /* PageTemplate id */; startOn?: Side | 'any' }>;
}

type RepeatSpec =
  | { over: 'months' } | { over: 'weeksOfMonth' } | { over: 'daysOfWeek'; group?: number /* days per page */ }
  | { over: 'count'; n: number } | { over: 'list'; items: string[] };

interface PageTemplate {
  id: string; name: LocalizedText;
  spread?: { group: string; position: 'left' | 'right' };  // two-page spreads (monthly/weekly)
  background?: PatternSpec;                        // blank | lined | dots | squares, pitch, opacity
  body: LayoutNode;                                // flow layout, see §5
  outerRail?: BlockInstance[];                     // blocks pinned to the outer margin
  free?: BlockInstance[];                          // opt-in absolute layer (x,y,w,h in mm)
  formatOverrides?: Partial<Record<FormatId, JsonPatch>>;
  rationale?: LocalizedText;                       // designer guidance ("why this layout"); never printed
  sampleContent?: Record<string /* blockId */, unknown>; // preview-only sample fill; never persisted per project
}
```

### 4.3 Blocks

```ts
interface BlockInstance {
  id: string;                                      // stable within its PageTemplate
  type: string;                                    // key in the block registry, never switch-cased in core
  props: unknown;                                  // validated by the registered block's Zod schema
  style?: BlockStyle;                              // typography, box, border — presentation only
  sideVariants?: Partial<Record<Side, Partial<BlockStyle>>>;
  size?: { width?: Length; height?: Length };
  frame?: { x: number; y: number; w: number; h: number }; // only for `free` layer
  visibility?: Condition;
  locked?: boolean;
  keepTogether?: boolean;                          // "prevent page break"
}
```

Content vs presentation: `props` holds *what* (texts, rows, scale mode, content binding), `style`
holds *how*. Styles resolve through theme tokens (`--font-body`, `--rule-weight`, `--ink-muted`), so
a grayscale export swaps tokens rather than applying a raster filter (§8.3).

### 4.4 Project and document (what *this* planner is)

```ts
interface PlannerProject {
  schemaVersion: number;
  id: string;
  meta: { name: string; createdAt: string; updatedAt: string; lastExport?: ExportRecord };
  templateSource: { id: string; version: string }; // provenance only
  template: PlannerTemplate;                       // forked copy — project owns it (ADR-0003)
  content: ContentLibraries;                       // forked copy
  generation: GenerationConfig;
  print: PrintSettings;
  locale: Locale; format: FormatId;
  i18nOptions: { grammaticalGender: 'slash' | 'feminine' | 'masculine' | 'neutral' };
  document: PlannerDocument;
  personalDataId?: string;                         // pointer into isolated store, never inlined
}

interface PlannerDocument { root: SectionNode }
interface SectionNode {
  key: string; title: LocalizedText; enabled: boolean;
  children: Array<SectionNode | PageInstance>;
}
interface PageInstance {
  key: string;                                     // semantic & stable: "m2/w3/d/2026-11-18"
  templateId: string;
  context: PageContext;                            // { date?, monthIndex?, weekIndex?, dayIndex?, dates?[] }
  enabled: boolean;
  origin: 'generated' | 'manual' | 'filler';
  overrides?: Record<string /* blockId */, BlockPatch>;   // sparse; absent = follows template
  contentAssignments?: Record<string /* blockId */, string /* contentItemId */>;
}
```

**Not stored:** page numbers, sides, spread partners, resolved geometry — all derived by `paginate()`
and `resolve()`.

**Style/props precedence** (low → high): registry defaults → page-template block → format override →
side variant → instance override. The inspector shows which level a value comes from and offers
"reset to template".

**Regeneration** (e.g. user changes start date): generate a fresh tree, then for every new instance
whose `key` matches an old one, carry over `overrides`, `contentAssignments`, `enabled`. Orphaned
overrides are listed in a dialog rather than silently dropped.

### 4.5 Content libraries (`packages/planner-content`)

```ts
interface ContentItem {
  id: string; kind: 'quote' | 'affirmation' | 'prompt' | 'sos-step' | 'warning-sign' | 'exercise';
  text: LocalizedText;
  author?: string; source?: string; license?: 'original' | 'public-domain' | 'cc-by' | 'user';
  categories: string[]; tags: string[];
  scope?: { months?: number[]; weeks?: number[] };   // enables "month 3 themes"
}
```

Blocks bind to content via a selector, e.g. the daily quote block:
`{ source: 'quote', filter: { categories: ['recovery','acceptance'] }, strategy: 'sequential' | 'seeded-shuffle', noRepeatWithin: 30 }`.
The generator resolves the selector **once** into `contentAssignments`, so reordering pages or
editing the library doesn't reshuffle quotes; a "re-deal quotes" action re-runs it explicitly.

#### 4.5.1 Quote authoring pipeline and assignment generator

**Cadence: daily** (`quoteCadence: 'daily'`, decided 2026-09-24). Each of the 182 daily spreads
prints a different quote at the top of the left page. The corpus target is **≥ 60 bilingual quotes**
(each used ≤ 3×, never within 30 days of itself). 182 quotes means no repeats. The wizard shows the
current ratio ("64 quotes → max 3 uses each") before generation. `weekly` and `none` stay as options.

Quotes are either written by the planner author or taken from a curated bilingual list. Both go
through one pipeline:

```text
curated source (spreadsheet / CSV / YAML)        in-app Content editor
  columns: id, en, pl, author, source,             (side-by-side en | pl,
  license, categories, tags, months                 per-locale review status)
          │                                                  │
          └──────────▶ planner-content: import + validate ◀──┘
                          • both locales present (or flagged draft)
                          • license ∈ {original, public-domain, cc-by, user}; cc-by needs attribution
                          • length ≤ fit budget for the quote block (e.g. 160 chars A4 / 110 chars A5)
                          • duplicate / near-duplicate detection (normalised text)
                          ▼
                    ContentLibrary (quotes.json, LocalizedText per record)
                          ▼
     assignment generator (runs inside generate(), deterministic):
       • 182 daily slots ← pool filtered by categories / month themes
       • strategy: sequential | seeded-shuffle | themed-by-month
       • constraints: noRepeatWithin N days; if the pool is smaller than the slot count,
         cycle and report it ("54 quotes for 182 days → each used ≤ 4×")
       • output: PageInstance.contentAssignments (stable across edits; "re-deal" to redo)
```

- `ContentItem.review?: Partial<Record<Locale, 'draft' | 'reviewed'>>` records translation
  status. A future AI-assisted translation step can only ever write `draft`. The export preflight warns on
  drafts.
- **Licensing:** the public therapeutic template ships only `original` and `public-domain` items.
  Items marked `user` stay in the author's own projects. Template export warns if it would include them.
  The demo's attributed quotes (AA Big Book, Frankl, Brown, Linehan, Rogers, Hemphill) go in the
  `user` category, not in the shipped corpus.
- Short AA slogans ("One day at a time", "Easy does it", "First things first") are common phrases.
  They can be written as `original` items without attribution to copyrighted literature.

Recommendation: store translations **inside each record** (`quotes.json` with `LocalizedText`) rather
than the brief's `quotes.en.json` / `quotes.pl.json`. Per-locale files drift apart by id; a single
record makes "missing translation" a local check. Per-locale CSV/XLIFF export for translators can be
tooling (ADR-0005).

### 4.6 Variables

| Kind | Examples | Source | Resolved |
|---|---|---|---|
| Page context | `dayName`, `currentDate`, `weekNumber`, `monthName` | generator (`PageContext`) | render |
| Derived | `sobrietyDayNumber` = `date − sobrietyStartDate + 1`, `plannerEndDate` | pure functions | render |
| Personal | `patientName`, `therapistName` | isolated personal-data store | render |

An unset variable renders as a handwriting blank (`______`, width configurable), never as the raw
`{{token}}` and never as an error. That makes anonymous planners the default path.

### 4.7 Conditions (visibility rules)

A small declarative, serialisable expression language (JSON-Logic subset: `==, !=, in, and, or, not,
var`) over `{ page, config, vars }`. No `eval`, so imported templates can't execute code. Example:
show the schedule block only on weekdays: `{ "in": [{ "var": "page.dayOfWeek" }, [1,2,3,4,5]] }`.

### 4.8 Migrations

`schemaVersion` on project, template and content. `planner-schema/migrations/` holds a chain of pure
`(vN) => vN+1` functions; import and load always run `migrate → validate`. Invalid imports are
rejected with a path-level Zod error report, never partially loaded.

---

## 5. Layout engine (`packages/planner-core`)

### 5.1 Page geometry

```text
      LEFT PAGE (verso, even)                    RIGHT PAGE (recto, odd)
 ┌ bleed ─────────────────────────────┐  ┌──────────────────────────────── bleed ┐
 │ ┌ trim ─────────────────────────┐  │  │  ┌──────────────────────────── trim ┐ │
 │ │   top                         │  │  │  │                         top      │ │
 │ │ ┌────┬──────────────────┬───┐ │  │  │  │ ┌───┬──────────────────┬────┐   │ │
 │ │ │out-│  content area    │bin│ │▐ spine ▌│ │bin│  content area    │out-│   │ │
 │ │ │er  │  (safe area =    │d- │ │  │  │  │ │d- │                  │er  │   │ │
 │ │ │rail│   content − inset)│ing│ │  │  │  │ │ing│                  │rail│   │ │
 │ │ └────┴──────────────────┴───┘ │  │  │  │ └───┴──────────────────┴────┘   │ │
 │ │   bottom                      │  │  │  │                       bottom     │ │
 │ └───────────────────────────────┘  │  │  └──────────────────────────────────┘ │
 └────────────────────────────────────┘  └───────────────────────────────────────┘
```

`resolveFrame(format, margins, side, bleed)` converts logical margins `{inner, outer, top, bottom}`
into physical `{left, right}` from `side`. Defaults (A4, sewn binding): inner 18, outer 14, top 14,
bottom 17 mm. A5 defaults: inner 15, outer 11, top 11, bottom 13 mm. Bleed defaults to **0** under
the home print profile (§8.4). Every margin is also clamped to ≥ the profile's **printer-safe
margin** (default 5 mm), because home printers can't print to the paper edge. The **outer rail**
is a configurable strip (default 0 mm; weekly template uses ~28 mm A4) inside the outer margin where
blocks like weekly goals are pinned, so they mirror automatically.

`page.side` is derived in `paginate()`: physical page 1 is a recto (right). Sections with
`startOn` or spread groups trigger filler pages (`origin: 'filler'`, template configurable: blank,
notes, or "intentionally left blank"). `paginate()` can also pad to an even count (duplex) or to a
signature multiple (sewn binding: 16/32) — reported in the page budget.

### 5.2 Flow layout (default) + free layer (opt-in)

```ts
type LayoutNode =
  | { kind: 'stack'; gap: number; children: LayoutNode[]; height?: Length; label?: LocalizedText } // vertical
  | { kind: 'row';   gap: number; children: LayoutNode[]; height?: Length }                    // horizontal, widths in fr/mm
  | { kind: 'block'; block: BlockInstance };
```

Rendered as CSS Grid/Flex with `mm` units; `fr` heights distribute remaining space. The daily page is
a `stack` of three labelled regions (Morning / Day / Evening) where Evening has `height: {fr:1}` — on
A5 it simply gets shorter. Overflow (fixed content exceeding the page) is detected after layout via
DOM measurement in the renderer and surfaced as a per-page warning badge, not silently clipped.

The `free` layer allows Canva-style x/y/w/h placement for decorative elements and bespoke pages;
free blocks carry per-format frames or get scaled proportionally when switching format (with a warning).

### 5.3 The daily spread (default) on A4 and A5

The daily spread uses the demo's content, with the demo's page order **reversed**: the day is read
left to right, Morning and Day on the left page and Evening on the right. It is two `PageTemplate`s in
one spread group (`daily-morning-day` = left, `daily-evening` = right). The generator emits one pair
of instances per date (`m2/w3/d/2026-11-18/L` and `…/R`) and they always move together when reordered.

| | Left page: **Morning & Day** | Right page: **Evening** |
|---|---|---|
| Top | date · **sobriety day no.** · daily quote · **24 h pledge** (Morning) | "What threatened my sobriety today?" (3 lines) |
| Middle | **3 priorities**, each with goal + plan + safeguard lines · **schedule 07:00–18:00, 2 lines/hour** in the outer column (`outerRail`) | **reflections**: dot grid 5 mm, fills the rest (`fr:1`) |
| Bottom | **HALT** full width (1–5, letter badges) | **gratitude ×3** ("What am I grateful for today?") |

This follows the brief's Morning → Day → Evening order in normal reading direction. The user plans on
the left in the morning, checks HALT during the day, and closes the day on the right. The right page's
reflection area is the largest writing space in the planner, which is the demo's intent. On the
right-hand page it also sits on the side of the book that is easiest to write on in a ring binder.

Side placement: the schedule sits in the **outer** column of the left page (its left edge), away from
the rings. On the right page the outer edge carries the page number and the reflection area runs
to the outer margin. HALT sits at the bottom of the left page, directly across from the evening
questions, so the day's tension levels are in view while writing the reflection.

| Setting | A4 default | A5 preset (`formatOverrides.A5`) |
|---|---|---|
| Quote | ≤ 160 chars | ≤ 110 chars |
| Priorities | goal + plan + safeguard | goal + safeguard |
| Schedule | 07–18, 2 lines/hour | 07–18, 1 line/hour, or 07–21 at 1 line/hour |
| HALT | 1–5 scale | 1–5 scale (checkbox mode optional) |

The one-page (`one-per-page`) daily template is kept as an alternative. It stacks the same blocks
Morning → Day → Evening with the schedule off by default. The overflow detector (§5.2) blocks
generation if a customisation no longer fits, and says which region overflows by how many mm.

### 5.4 Spread-split blocks

Some content should run across both pages of a spread, like the demo's monthly calendar (Mon–Thu on
the left, Fri–Sun on the right). A spread `PageTemplate` pair can host a block with
`spreadSplit: { left: [0, 4], right: [4, 7] }` over the block's column axis. The block renders once
per page with its slice. Selection and editing act on the single logical block. The binding gutter
between slices is **never** bridged by content: each slice keeps its own inner margin.

---

## 6. Block system (plugin registry)

```ts
interface BlockDefinition<P> {
  type: string;                        // 'rating-matrix'
  version: number;                     // for per-block prop migrations
  propsSchema: z.ZodType<P>;
  defaults: P;
  localizedFields: (p: P) => LocalizedText[];     // feeds the translation scanner
  Render: React.FC<BlockRenderProps<P>>;          // same component in editor, preview, print
  inspector: InspectorField[];                    // declarative: generates the right-panel form
  palette?: { label: LocalizedText; icon: string; category: string };
  capabilities: { resizable: boolean; minSize?: Size; inlineEditable?: boolean };
}
```

Core ships **generic** primitives; therapeutic components are **presets** (a registered type + preset
props), which is what keeps the engine planner-agnostic:

| Palette item (brief) | Generic block type | Preset config |
|---|---|---|
| Heading, Text, Quote, Affirmation | `text` (variants), `content-slot` | quote/affirmation bind to libraries |
| Text field, Lined notes, Dot grid | `writing-area` | `pattern: lines|dots|squares|blank, pitch: 5mm, opacity` |
| Checkbox, Daily/Weekly/Monthly goals | `numbered-list` | `count: 3`, `marker: checkbox|number`, `subLines` (e.g. plan / safeguard) |
| Rating scale, HALT tracker, Habit tracker | `rating-matrix` | rows H/A/L/T; `mode: checkbox|scale-1-5|scale-0-10`; `noteColumn` |
| Calendar | `calendar-grid` | `cells: 35`, week start Monday, locale-aware |
| Wheel of Life | `radial-scale` | 8 segments × 1–10 rings, printable blank |
| Warning signs, Gains/Losses | `category-grid` | 2×2 quadrants, editable headings & placeholder examples |
| Emergency contacts | `contact-table` | roles × fields (name, phone, alt phone, notes) |
| SOS procedure, Reflection questions | `numbered-list` + content binding | `source: sos-step | prompt` |
| Weekly day markers | `day-strip` | Mon–Sun, marker set (AA, therapy, doctor, exercise, recovery, high-risk, custom) with **shape + letter**, not colour; per-day sobriety counter |
| Schedule | `time-grid` | `from: 05:00, to: 23:00, step: 60, linesPerSlot: 1|2` |
| Divider, Spacer, Icon, Page number | `divider`, `spacer`, `icon`, `page-number` | page number placed in outer corner via side variant |

Adding a new planner type = new template JSON + (maybe) new presets. Adding a genuinely new widget =
one `BlockDefinition` registration; no core changes.

---

## 7. Internationalisation (`packages/planner-i18n`)

Two separate concerns:

1. **UI strings** — `next-intl` message catalogues `apps/web/messages/{en,pl}.json`; locale in URL
   segment (`/pl/…`) so it's switchable anywhere and bookmarkable. UI locale ≠ planner locale.
2. **Planner content** — `LocalizedText` everywhere; `t(text, locale, fallback?)` returns the string or
   a visible `⟨missing: pl⟩` marker in the editor (never in print — print falls back to other locale
   and the export dialog blocks/warns).

Helpers:
- `formatMonth(date, locale, 'standalone' | 'in-date')` via `Intl.DateTimeFormat#formatToParts` →
  "październik" in headings, "1 października" in dates.
- Weekday names, week numbers (ISO-8601), `Intl.PluralRules` for "3 dni / 5 dni".
- Gendered forms: `"Za co jestem dziś {g:wdzięczny|wdzięczna}?"` rendered per
  `i18nOptions.grammaticalGender` (`slash` → "wdzięczny / wdzięczna"). Authors can also write a
  neutral rephrasing ("Za co dziś dziękuję?") — the brief's "gender-neutral where practical".
- Translation scanner: walks templates + content via `localizedFields`, produces a report
  (location, en, pl, status) that powers the "missing translations" panel and the side-by-side editor
  with "copy en → pl".

---

## 8. Rendering, print & export

### 8.1 One renderer, three modes
`planner-renderer` exports `<PageView page={ResolvedPage} mode="edit|preview|print" />`. The editor
wraps it with overlays (guides, rulers, selection handles, margin tints) that **are not** in the
print DOM. Zoom is a CSS `transform: scale()` on the viewport, so the page itself is always laid out
in real `mm`. The page list and preview are virtualised (only visible pages mount), which keeps
500-page documents cheap.

### 8.2 Print-fidelity rules
- Patterns (dot grid, lines, squares) drawn as **inline SVG `<pattern>`** in mm, not CSS gradients —
  Chromium keeps SVG vector in PDF; gradients may rasterise.
- Minimum stroke 0.3 pt (≈0.1 mm); dots r = 0.25 mm; subtle via **ink value** (K 35–50 %), not
  opacity on light colours, so they survive grayscale and cheap printers. Presets tested on real prints.
- Self-hosted fonts (WOFF2, e.g. Inter / Source Serif 4 — full Latin Extended-A for ą ę ł ń ó ś ź ż);
  export waits for `document.fonts.ready`. Chromium embeds subsets.
- Images: authored ≥ 300 DPI at placed size; the export preflight warns below that.

### 8.3 PDF pipeline (`packages/planner-pdf`)

```ts
interface Exporter<Opts> {
  id: 'pdf-chromium' | 'pdf-browser-print' | 'json' | 'png' | 'svg' | 'docx';
  export(project: PlannerProject, opts: Opts, onProgress?: (p: number) => void): Promise<Blob>;
}
```

```text
Browser (editor)                         export backend: export-node (Playwright) | export-cf (Browser Run)
────────────────                         ──────────────────────────────────────────────────────────────
Export dialog ─▶ preflight (overflow,    POST /api/export/section { project, sectionKey, format, profile }
   missing translations, low-DPI)          × one per section (intro, month 1…n, crisis), 2–3 in parallel
                                  ─────▶  ├─ load /print route (static build of renderer)
                                          ├─ inject project → paginate → render THIS section's pages
                                          ├─ await fonts.ready + images
                                          ├─ page.pdf({ preferCSSPageSize: true, printBackground })
                                          │     @page size = trim + 2·bleed (+ slug for crop marks)
                                          └─ return bytes; nothing written to disk/logs
◀───────────────────────────────────────  application/pdf (per section)
merge sections (pdf-lib, in browser)
→ impose per print profile (§8.4), ViewerPreferences, TrimBox/BleedBox, metadata
→ download (whole planner, or single month for ring binders)
```
The payload is design data only. Personal variables are off by default (blank template, §10.2).

- **Bleed & crop marks:** media box = trim + 2·bleed (+ 2·slug when marks on); marks drawn in the slug
  by the print route; `TrimBox`/`BleedBox` set with `pdf-lib` so print shops can read them.
- **Grayscale:** swap to a grayscale token set before render (keeps vectors). Never CSS `filter`.
- **Duplex / mirrored margins / blank insertion:** handled upstream in `paginate()`; the PDF is
  simply the correct page sequence.
- **Fallback adapter:** `pdf-browser-print` uses `window.print()` with the same print CSS for
  fully-offline use (no bleed/crop control, user picks printer settings).
- **Imposition** (§8.4) runs after rendering. `pdf-lib` `embedPage` places the rendered vector pages
  onto output sheets, so text stays vector.
- **CMYK / PDF/X:** out of scope (home printing). This can come back later as a `print-shop` profile.

### 8.4 Printing on the user's own hardware (ADR-0006)

Home inkjet/laser printers can't print to the paper edge, may not duplex, and have print dialogs that
scale pages by default. Export is organised around **print profiles**:

| Profile | Bleed / crops | Page order | Sheet | Use |
|---|---|---|---|---|
| `home-duplex` (**default for A4**) | none | reading order, padded to whole sheets | A4 | printer with auto-duplex |
| `home-manual-duplex` | none | two files, or one file + instructions: odd pages, then even pages reversed | as designed | printer without duplex |
| `home-a5-2up` (**default for A5**) | none | 2 A5 pages per A4 landscape sheet, **cut-and-stack** order, duplex-aware | A4, cut to A5 | A5 planner printed on a normal A4 printer |
| `home-a5-native` | none | reading order | A5 | printer with an A5 tray |
| `home-booklet` (later) | none | folded signatures (4 sheets = 16 pages) | A4 → A5 booklets | sewn binding, if ever needed |
| `print-shop` (later) | 3 mm + crop marks | reading order | as designed | professional printing |

**Cut-and-stack** (for `home-a5-2up`): with *N* A5 pages on *N/4* A4 sheets, the top halves carry
pages 1…N/2 and the bottom halves carry N/2+1…N. Fronts and backs are paired so that after the
user guillotines the whole stack in one cut and puts the bottom pile under the top pile, the pages are
in reading order and every back sits behind its front. A naive 2-up would need the user to reorder
hundreds of half-sheets by hand. An imposition unit test checks the sheet-side table (§15).

#### Ring binding (default for A4 and A5)

`PrintSettings.binding`:

```ts
type Binding =
  | { kind: 'ring'; preset: 'iso838-2hole' | 'iso838-4hole' | 'a5-6ring' | 'custom';
      holeCentreFromEdge: number; holeDiameter: number; holePositions: number[] /* mm along edge */;
      punchGuides: boolean }                 // faint tick marks at hole centres to guide a hand punch
  | { kind: 'sewn' } | { kind: 'none' };
```

- **Hole zone.** For the ISO 838 2-hole preset, holes are Ø 6 mm with centres 12 mm from the edge and
  80 mm apart. That is a 15 mm keep-out strip plus 3 mm clearance, so the inner (binding) margin is
  clamped to **≥ 18 mm**. The `a5-6ring` preset follows common A5 organiser spacing. The canvas draws
  the holes in the binding-zone overlay. Blocks can't be placed into the hole zone; the snap rules
  refuse it.
- **Mirroring still applies.** On a ring-bound sheet the holes are on the left of the front (recto)
  and on the right of the back (verso). This is the same inner/outer logic as sewn binding.
- **Sheet-aligned sections.** In a ring binder, sheets can be added one month at a time, but only if
  no sheet carries pages from two months. A section with `sheetAligned: true` starts on a **recto**
  (front of a new sheet) and is padded to end on a **verso**. For months this gives:
  `month divider (recto, month name, acts as a tab page) → monthly spread (L/R) → weeks → daily spreads
  → month-end spread → notes → filler notes page if needed (verso)`. That adds ~2 pages per month
  (474 → ~486 pages) and allows **per-section export** ("Print month 3 only"). Printing months as you
  go replaces the `volumes` option as the main answer to the planner's thickness. `volumes` stays
  available for single-file exports.
- **Capacity.** ~486 pages = 243 sheets on 80–90 g/m² paper needs a ~40–50 mm D-ring binder for A4.
  For A5 a 30 mm ring holds ~2 months at a time, so per-month printing is the recommended flow and the
  export dialog says so.

Aids built into every home export:
- PDF `ViewerPreferences`: `/PrintScaling /None` and `/Duplex /DuplexFlipLongEdge` (booklet: `ShortEdge`).
  Acrobat honours these, other viewers partly. The export dialog also tells the user to print at
  **"Actual size / 100 %"**.
- An optional **calibration page** (page 1 of a separate PDF). It has a 100 mm ruler in both axes to
  check scaling, and front/back registration marks to check duplex alignment before printing ~240 sheets.
- `paginate()` pads sheet-aligned sections to whole sheets (and 2-up exports to multiples of 4 pages).
  Padding pages use the notes template, not blank paper.
- A contrast preset for home devices: dot grid K 50 %, r = 0.3 mm; rules ≥ 0.4 pt. Inkjets bleed
  thin light lines away, lasers dither light greys. The daily page is test-printed on one inkjet and
  one laser each release (§15).

Duplex alignment on home printers is a few mm off at best. The mirrored binding margin (≥ 18 mm with
rings) covers this, which is another reason the inner margin must never drop below the safe minimum.

---

## 9. Application layer (`apps/web`)

### 9.1 Routes
```text
/[locale]                         Dashboard
/[locale]/new                     Wizard: template → format → language → dates → density → optional variables → generate
/[locale]/p/[projectId]           Designer
/[locale]/p/[projectId]/preview   Page / spread / print preview
/print                            Headless print route used by export-worker (no chrome, no editor code)
```
The app is client-rendered (data lives in IndexedDB); Next.js provides routing, i18n and static
bundling. No server actions touch project data.

### 9.2 State

| Store | Contents | Persisted | Undo |
|---|---|---|---|
| `documentStore` | the `PlannerProject` | yes (autosave) | yes — immer patches, 200-step history |
| `editorStore` | selection, edit scope (`this page` / `all pages using template`), zoom, view (single/spread), guides toggles, active panel tab | per-project prefs only | no |
| `libraryStore` | content-library filters, search | no | no |

All document mutations go through **commands** (`setBlockProp`, `moveBlock`, `toggleSection`,
`overrideInstance`, `regenerate` …). One choke-point gives undo/redo, autosave, dirty tracking,
and a future path to collaboration (commands ≈ ops) without rewriting the editor.

**Edit scope** is the central UX affordance: editing a block on a daily page defaults to
"All 182 *Daily* spreads" (template edit) with a toggle for "Only this page" (instance override).
Overridden blocks show a marker (icon + outline style, not colour only) and "Reset to template".

### 9.3 Designer panels
- **Left:** Pages (virtualised section tree with drag-reorder via dnd-kit, enable/disable toggles,
  filler pages shown greyed) · Components (palette from registry) · Templates (page templates in this
  project) · Content (libraries) · Variables.
- **Centre:** canvas with rulers (mm), 1/5 mm grid, snap, alignment guides; tinted overlays for bleed
  (red hatch), binding (blue hatch), outer rail, safe area; single/spread toggle.
- **Right:** inspector generated from `BlockDefinition.inspector` — Typography · Layout · Content
  (en/pl side-by-side, copy-across, variable picker) · Visibility · Print (keep-together, side placement,
  outer-rail pin).

dnd-kit handles palette→canvas drops and tree/flow reordering; resize handles use plain pointer
events (dnd-kit is not a resize library), snapping in mm.

---

## 10. Persistence, privacy & security

### 10.1 Repository abstraction
```ts
interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<PlannerProject>;
  save(p: PlannerProject, opts?: { snapshot?: string }): Promise<void>;
  duplicate(id: string): Promise<string>;
  delete(id: string): Promise<void>;
  listVersions(id: string): Promise<VersionSummary[]>;
  restoreVersion(id: string, versionId: string): Promise<void>;
}
// + TemplateRepository, ContentRepository, PersonalDataRepository, ThumbnailRepository
```
MVP adapter: **IndexedDB via Dexie**. A future `HttpRepository` implements the same interfaces.

| Dexie table | Key | Notes |
|---|---|---|
| `projects` | id | summary fields for the dashboard (name, format, locale, pageCount, updatedAt, exportStatus) |
| `projectDocs` | id | full `PlannerProject` JSON |
| `versions` | [projectId+createdAt] | manual "Save version" + auto snapshot every 30 min of editing; cap 50 |
| `templates`, `contentLibraries` | id | user library (built-ins are bundled, read-only) |
| `personalData` | id | **deferred** (blank-template product, §10.2). The repository interface is reserved so it can be added later as an isolated table |
| `thumbnails` | projectId | small PNG of page 1, rendered client-side after save (idle callback) |

Autosave: debounced 1 s after last command + on `visibilitychange`. `navigator.storage.persist()`
requested so the browser doesn't evict data; dashboard nudges users to export JSON backups since
local storage is not a backup.

### 10.2 Privacy
The product makes **blank planners**. Patients fill them in by hand on paper, so their answers never
enter the software. This is the strongest privacy guarantee available and the design keeps it:
- No analytics, no third-party requests at runtime (fonts self-hosted), no cloud sync.
- The hosted instance keeps the same local-first model: projects live in the visitor's browser
  (IndexedDB). The server stores nothing (§10.4).
- Personal variables (`patientName`, `therapistName`, `sobrietyStartDate`) are **off by default** and
  print as handwriting lines. The `personalData` table and repository are **deferred**. If a designer
  chooses to pre-print a name, it is stored in the project's `generation.variables` and marked
  `personal: true`. Template export strips it, and the export dialog shows a warning.
- No interactive self-assessment widgets (the Wheel of Life is printed blank), so no health data exists.
- Export worker is stateless: request body in memory only, no logging of payloads.

### 10.3 Security
- Imported JSON: size limit (10 MB), `migrate → Zod validate`, no code in templates (conditions are
  data, no `eval`, no HTML strings — rich text is a structured mark model rendered by React).
- Export worker: bind to localhost by default; if exposed, add auth + rate limit; Chromium runs with
  JS limited to the print bundle and network disabled except the print route.
- Strict CSP (`default-src 'self'`); no `innerHTML`; the print route accepts only schema-valid JSON.

### 10.4 Deployment: local dev and Cloudflare hosting (ADR-0007, ADR-0008)

The web app is **client-only** (data in IndexedDB, no server state), so it builds as a static site
(`next build` with `output: 'export'`; next-intl locale segments via `generateStaticParams`). The only
server-side work is turning the `/print` page into a PDF. That sits behind one HTTP contract,
implemented by two interchangeable backends:

```text
POST /api/export/section
  body:  { project (schema-valid JSON, ≤ 10 MB), sectionKey, format, printProfile }
  reply: application/pdf (one section: a month, the intro, or the crisis part), vector, trim-sized
```

```text
LOCAL DEV (pnpm dev)                          CLOUDFLARE (preview + production)
────────────────────                          ──────────────────────────────────────────────────
next dev          :3000  web + /print         Cloudflare DNS + proxy (TLS, WAF rate-limit rule on /api/*)
export-node       :3001  Node + Playwright    ├─ Workers Static Assets: the exported Next.js site
  (same contract; also usable as a            └─ Worker `planner-export`
   Docker image for self-hosting)                  • Browser Run binding (@cloudflare/puppeteer)
                                                   • opens https://<host>/print, injects project JSON,
IndexedDB in the browser                             page.pdf() for ONE section, returns bytes
                                                   • keep_alive ≤ 10 min, browser.close() after each job
                                                   • no body logging, no storage
```

**Why per-section rendering.** A whole 486-page planner in one request would push a Worker's
memory limit and Browser Run's session timeouts. A month section is ~80 pages and renders in ~10 s.
The export dialog calls `/api/export/section` once per section, 2–3 in parallel, and shows progress.
Then **in the browser** it:
1. merges the section PDFs with `pdf-lib`;
2. applies the print profile (2-up cut-and-stack imposition, ViewerPreferences, punch guides);
3. offers the download.

Ring-bound users can also download a single month without merging. This keeps the server side
stateless and cheap, and the same client code works against both backends.

| Setting | Local dev | Cloudflare |
|---|---|---|
| `NEXT_PUBLIC_EXPORT_URL` | `http://127.0.0.1:3001` | `/api/export` (same origin, routed to the Worker) |
| Fallback | browser print if the export server is down | browser print if Browser Run returns 429/5xx after retries |
| Privacy notice | not shown | short notice before first export ("design sent only to render the PDF, not stored") |
| Abuse protection | none (localhost) | WAF rate-limit rule (e.g. 30 section requests / 10 min / IP), same-origin check, body-size limit, schema validation before launching a browser |
| Cost | none | Workers Paid ($5/month) recommended: the Free plan's 10 browser-minutes/day is roughly 10 full-planner exports. Browser Run time is billed per browser-hour beyond the included amount |

Browser Run limits checked on 2026-09-24 ([limits page](https://developers.cloudflare.com/browser-rendering/platform/limits/)).
Workers Free allows 10 browser-minutes/day and 3 concurrent browsers. Workers Paid has no hour
cap and allows 200 concurrent browsers. The default idle timeout is 60 s, extendable to 10 min with
`keep_alive`. These limits drive the per-section design. Re-check them before launch.

**Escape hatch.** If Browser Run's output differs from local Playwright (fonts, SVG patterns) or its
limits get in the way, the `export-node` Docker image deploys unchanged to **Cloudflare Containers**
or any container host (Fly.io, a Hetzner VPS). The web app only needs `NEXT_PUBLIC_EXPORT_URL` changed.
A visual-diff CI job (§10.5) compares Browser Run output with local Playwright output on every
release to catch drift early.

- **Offline / PWA** (optional, later): the hosted web app can be installed and work offline, using the
  browser-print fallback until a connection is available.

### 10.5 Environments and CI/CD (GitHub Actions → Cloudflare)

| Environment | Trigger | URL | Purpose |
|---|---|---|---|
| **dev** | `pnpm dev` (or `docker compose up`) | `localhost:3000` | daily development; hot reload; local Playwright export |
| **preview** | every pull request | `pr-<n>.<project>.workers.dev` (Worker versions / preview URLs) | review UI and PDF output before merging |
| **production** | merge to `main` (+ manual approval gate in the GitHub environment) | custom domain, e.g. `planner.<your-domain>` | public app |

```text
PR opened/updated ─▶ ci.yml
  1. pnpm install (cached) → lint (eslint, boundaries) → typecheck (tsc -b) → unit tests (vitest)
  2. build static site + worker bundle (wrangler deploy --dry-run)
  3. e2e + accessibility (Playwright + axe) against `next start` + export-node
  4. PDF assertions (page boxes, page count, fonts embedded, imposition tables)
  5. visual regression of template pages {A4,A5}×{en,pl}×{L,R}; diffs uploaded as artefacts
  6. deploy preview: wrangler versions upload → comment preview URL on the PR
merge to main ─▶ deploy.yml
  1. same checks (reuse ci.yml via workflow_call)
  2. wrangler deploy (static assets + planner-export Worker) to production, environment "production"
  3. smoke test: load app, generate demo project, export one section via Browser Run, check PDF size
  4. on failure: wrangler rollback to previous version
nightly ─▶ drift.yml: render sample sections on Browser Run and locally; image-diff; open an issue on drift
```

- **Secrets:** `CLOUDFLARE_API_TOKEN` (scoped to Workers Scripts:Edit + account read, this account only)
  and `CLOUDFLARE_ACCOUNT_ID` in GitHub environment secrets. No other secrets exist: there is no database.
- **Config as code:** `wrangler.jsonc` in the repo (assets dir, Browser binding, routes, compatibility
  date). The WAF rule and DNS records are documented in `docs/operations/cloudflare.md`, or managed
  with Terraform later.
- **Releases:** conventional commits + `changesets` for version tags. The app footer shows the build
  SHA so bug reports can be matched to a deployment.
- **Dependency hygiene:** Renovate/Dependabot weekly. The Chromium version is pinned in `export-node`
  so local output matches CI.

### 10.6 Domain

- **Registrar:** Cloudflare Registrar sells domains at cost (no markup) and bundles DNS, TLS and
  auto-renewal in the same dashboard as the deployment. This is the lowest-maintenance option for
  `.com`/`.app`/`.org` and 400+ other TLDs.
- **If you want a `.pl` domain:** check Cloudflare's TLD list first. If `.pl` isn't offered, register
  it with a Polish registrar (e.g. OVHcloud, home.pl, nazwa.pl) and point its nameservers at
  Cloudflare. DNS, TLS and deployment then work the same way, and only renewal happens at the other
  registrar.
- Turn on auto-renew, registrar lock and DNSSEC. Add `CAA` records for Cloudflare's certificate
  authorities. Set up an email alias for registrar notices so renewals aren't missed.

---

## 11. Repository layout (refinement of the brief)

```text
planner-creator/
├── apps/
│   ├── web/                     Next.js app, static export (features/ as in the brief + messages/{en,pl}.json)
│   ├── export-node/             Node + Playwright export server (local dev, CI, Docker escape hatch)
│   └── export-cf/               Cloudflare Worker on Browser Run (wrangler.jsonc); same HTTP contract
├── packages/
│   ├── planner-schema/          Zod schemas, types, migrations      (no deps)
│   ├── planner-i18n/            LocalizedText, Intl helpers, scanner
│   ├── planner-core/            registry, paginate, resolve, overrides, conditions, variables
│   ├── planner-generator/       repeaters, calendar maths, content assignment
│   ├── planner-content/         library loading, filtering, selection strategies
│   ├── planner-blocks/          built-in BlockDefinitions (added: keeps renderer free of widgets)
│   ├── planner-renderer/        PageView, layout nodes, print CSS
│   └── planner-pdf/             Exporter interface + adapters
├── templates/therapeutic-recovery/
│   ├── template.json
│   ├── content/{quotes,affirmations,prompts,sos,warning-signs}.json   (LocalizedText per record)
│   └── README.md
├── .github/workflows/           ci.yml, deploy.yml, drift.yml
└── docs/{architecture,adr,operations,reference}/, print-specification.md, planner-schema.md, therapeutic-template.md
```

---

## 12. Generator details (`packages/planner-generator`)

- **Start date is chosen in the creator.** The wizard has a date picker (day, month, year; localised,
  Monday-first; keyboard-accessible). The default is the first day of next month. Changing it later
  in project settings triggers regeneration with override re-attachment (§4.4). `durationMonths` is
  1–12, default 6.
- **Date range:** `endDate = startDate + durationMonths − 1 day`. Calendar maths with `date-fns`
  (+ `date-fns/locale/pl`), dates as ISO `YYYY-MM-DD` strings (no time zones in documents).
- **Month blocks follow calendar months** (`monthMode: 'calendar'`, default). A mid-month start such as
  2026-10-15 gives a partial first block (15–31 Oct) and a partial last block (1–14 Apr): 7 blocks
  for 6 months. Month-opening calendars grey out days outside the range. **Every calendar month in
  the range gets its own block, starting with its own month-opening pages, however short it is**
  (decided 2026-09-24; no merging). A start on 2026-10-30 still gets an October opening spread
  followed by that one partial week. The wizard previews the block list and page count live. `monthMode: 'rolling'` (month n = start + n−1 months)
  is available for programmes that count "month 1…6" from admission.
- **Weeks:** Monday-start. Month *m* owns every week whose **Monday falls in month m**; the first
  planner week is the week containing `startDate` and belongs to month 1. Days outside
  `[startDate, endDate]` get no daily page and are greyed on the weekly spread. For 2026-10-01 →
  2027-03-31 this yields 5, 5, 4, 4, 4, 5 weeks (27 total). Rule is a config option
  (`weekOwnership: 'monday' | 'iso-thursday'`) since some programmes prefer ISO semantics.
- **Undated mode** (secondary option): no `startDate` → 4 weeks/month (or configurable), blank date
  fields. One PDF can then be reused for any start day.
- **Determinism:** `generate()` is pure; seeded shuffles use `hash(projectId + selectorId)` so the same
  config always yields the same planner.
- **Output:** `PlannerDocument` + `PageBudget` (`{ total, byTemplate, fillers, paddingToSignature }`)
  shown live in the wizard.

Therapeutic template structure (data, not code):
```text
intro (startOn right): cover, how-to-use, therapeutic contract, safety rules, …        8
months × durationMonths
  ├─ monthly-opening  (spread, startOn left)                                           2
  ├─ weeksOfMonth
  │    ├─ weekly       (spread, startOn left | single)                                 2 | 1
  │    └─ daysOfWeek   dailyLayout: spread (default, startOn left) | one-per-page | two-per-page   14 | 7 | 4*
  ├─ month-end spread (startOn left): wheel-of-life | monthly-review                   2
  └─ notes (dots 5 mm) × 2                                                             2
crisis (startOn left): warning signs ×2, gains/losses, support network, SOS, notes…   12
* 2-per-page on a 7-day week: 3 full pages + 1 page with Sunday + weekly reflection block.
```

---

## 13. Open questions

All product questions raised so far are resolved (§2.1): density, week rule, print target, binding
(rings), blank template, daily quotes, start date in the creator, self-hosting on Cloudflare, demo
copied, every month gets its own opening pages (§12).

- **Quote corpus:** the project owner writes the quotes, needed by M5. There are 12 original en/pl
  seed quotes in `templates/therapeutic-recovery/content/quotes.json`, so ≥ 48 more are needed.
- **Domain name and TLD:** to be decided. This blocks only M8 (production). Until then, previews and
  staging run on `*.workers.dev`. If `.pl` is chosen, check Cloudflare Registrar support (§10.6).

---

## 14. Delivery plan (maps to brief's MVP order)

| Milestone | Brief items | Deliverable | Exit criterion |
|---|---|---|---|
| M0 Foundations | 1, 4 | monorepo, `planner-schema`, migrations, Dexie repos; **dev server, `ci.yml`, preview deploys to Cloudflare from day one** | round-trip JSON property tests pass; every PR gets a preview URL |
| M1 Print model | 2, 3 | `paginate`, `resolveFrame`, `PageView`, print route | A4/A5 pages render at true size; mirrored margins visible in spread |
| M2 i18n | 5 | `planner-i18n`, next-intl UI, scanner | whole UI + template switch en↔pl; missing-translation report |
| M3 Therapeutic pages | 6, 7, 8, 10, 11 | built-in blocks + presets, template.json | demo project contains every required page type |
| M4 Generator | 9 | repeaters, week rule, calendar/rolling months, wizard date picker, fillers, page budget | golden tests for 12 start dates incl. mid-month and every weekday; spreads always start left |
| M5 Content | 12 | libraries, CSV/YAML import + validation, daily assignment generator, content editor | ≥ 60 quotes loaded; repeat report correct |
| M6 Editor | 13, 14 | 3-panel designer, commands, undo, edit scope | acceptance criteria 10–14 |
| M7 Export | 15, 16 | `export-node`, per-section contract, client merge + imposition, `home-duplex` + `home-manual-duplex` + `home-a5-2up`, ring binding + sheet-aligned sections, per-month export, calibration page, JSON import/export | PDF page box = 595.28×841.89 pt (A4) / 419.53×595.28 pt (A5) ± 0.01; test print at 100 % matches rulers ± 0.5 mm; punched holes clear all content |
| M8 Production | — | `export-cf` on Browser Run, `deploy.yml` + smoke test + rollback, `drift.yml`, WAF rule, domain + DNS, privacy notice | production deploy from `main`; Browser Run vs local visual diff within threshold |
| M9 Extras | — | `home-booklet`, handwriting-sample preview, PWA/offline | — |

Advanced editor features (free layer, alignment guides, multi-select, rich text) come after M7.

## 15. Testing strategy

- **Unit (Vitest):** calendar/week ownership, pagination & fillers, margin mirroring, override
  precedence, condition evaluator, variable resolution, migrations.
- **Golden structure tests:** snapshot of `generate()` page keys for fixed configs (catches accidental
  reshuffles that would break regeneration).
- **Visual regression (Playwright):** screenshot every template page in {A4, A5} × {en, pl} × {left, right}.
- **PDF assertions:** parse output with `pdf-lib` — page count, MediaBox/TrimBox sizes, fonts embedded,
  no raster images for patterns.
- **Accessibility:** `axe-core` in Playwright on dashboard, wizard and designer; keyboard-only E2E for
  the acceptance-criteria flow.
- **Imposition tests:** for `home-a5-2up`, assert page order on each sheet side against a computed
  cut-and-stack table, e.g. N = 8: sheet 1 front = [1 | 5], back = [2 | 6]; sheet 2 front = [3 | 7],
  back = [4 | 8], with back positions mirrored for the flip edge. Also assert that every sheet-aligned
  section starts on a recto and ends on a verso.
- **Print check:** each release, physical test prints of the daily page on one inkjet and one laser,
  in grayscale (dot/rule visibility, duplex registration, 100 mm ruler).

## 16. Trade-offs and what to revisit as the system grows

| Decision | Chosen | Cost accepted | Revisit when |
|---|---|---|---|
| Local-first IndexedDB | no backend, private by default | no cross-device, eviction risk | users need sync/sharing → `HttpRepository` + auth |
| Project forks its template | edits never leak across projects | template updates don't propagate | template marketplace/versioned upgrades → 3-way merge |
| Flow layout default | format-independent reflow | less freeform than Canva | designers need freeform pages → invest in free layer |
| Chromium PDF | WYSIWYG, vector, one renderer | RGB only, server component | offset printing → Ghostscript PDF/X step (`print-shop` profile) |
| Home print profiles + imposition | works on users' printers, enables home sewing | viewer scaling can't be fully controlled | print-shop partners appear → add `print-shop` profile |
| Hosted = local-first + stateless worker | no server storage, same code both ways | no cross-device access; worker cost per export | accounts requested → `HttpRepository`, encrypted personal-data store |
| Materialised instances + overrides | per-page edits and regeneration | override re-attachment logic | very large planners (1000+ pages) → lazy instance creation |
| Commands through one store | undo, autosave, future collab | boilerplate per mutation | real-time collaboration → CRDT (Yjs) on the same command surface |
| Personal data isolated | privacy by construction | extra indirection | clinical data module → separate encrypted store & consent model |
