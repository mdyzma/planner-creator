# planner-creator

A web application to design, customise and print bilingual (Polish / English) therapeutic planners.
The first template is a 6-month recovery planner. Planners are printed blank on the user's own
printer, filled in by hand and ring-bound.

- Design: [docs/architecture/system-design.md](docs/architecture/system-design.md)
- Decisions: [docs/adr/](docs/adr/)
- Deployment: [docs/operations/cloudflare.md](docs/operations/cloudflare.md)

## Requirements

- Node.js 24 (see `.nvmrc`; 22+ works)
- pnpm via Corepack: run `corepack enable` once (the version is pinned in `package.json`)

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # lint + typecheck + tests + build, the same as CI
```

PDF export runs through a small local service that drives your installed Google Chrome
(see apps/export-node/README.md):

```bash
pnpm --filter @planner/web build
pnpm --filter @planner/export-node serve   # http://127.0.0.1:8787, used by the Export screen
```

## Layout

```text
apps/web                 Next.js app (static export, data in the browser's IndexedDB)
apps/export-node         Local PDF export service and CLI (headless Chrome via playwright-core)
packages/planner-schema  Zod schemas, types, migrations, defaults
packages/planner-i18n    Translations lookup, dates, plurals, gendered wording, translation scanner
packages/planner-core    Pagination (sides, spreads, fillers) and page geometry (margins, binding, rail)
packages/planner-renderer React page rendering in mm, guides, print CSS
packages/planner-blocks  Block registry and built-in block types (text, lists, HALT, calendar, Wheel of Life…)
packages/planner-generator Calendar planning, template expansion, content dealing, page budget, regeneration
packages/planner-content  Content checks (translations, length, licence, duplicates), CSV import/export, filters
packages/planner-editor  Designer commands (edit scope, structure), undo history
packages/planner-pdf     Export plan, merging, imposition (2-up, manual duplex), calibration sheet
packages/planner-storage Repository interfaces + IndexedDB (Dexie) and in-memory implementations
templates/               Planner templates: TypeScript source compiled to template.json, plus bilingual content
docs/                    Architecture, ADRs, operations, frozen demo reference
```

Status: **M7 (export)**: an Export screen per planner: whole planner or one month at a time, print options for two-sided, by-hand and A5-two-per-A4 printing, a calibration sheet, and JSON backup and template files (import on the dashboard). Earlier: M6 visual designer, M5 content, M4 generator, M3 therapeutic pages, M2 internationalisation, M1 print model. See the delivery plan in the design doc, §14.
