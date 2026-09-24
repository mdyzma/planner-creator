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

## Layout

```text
apps/web                 Next.js app (static export, data in the browser's IndexedDB)
packages/planner-schema  Zod schemas, types, migrations, defaults
packages/planner-i18n    Translations lookup, dates, plurals, gendered wording, translation scanner
packages/planner-core    Pagination (sides, spreads, fillers) and page geometry (margins, binding, rail)
packages/planner-renderer React page rendering in mm, guides, print CSS
packages/planner-blocks  Block registry and built-in block types (text, lists, HALT, calendar, Wheel of Life…)
packages/planner-generator Calendar planning, template expansion, content dealing, page budget, regeneration
packages/planner-storage Repository interfaces + IndexedDB (Dexie) and in-memory implementations
templates/               Planner templates: TypeScript source compiled to template.json, plus bilingual content
docs/                    Architecture, ADRs, operations, frozen demo reference
```

Status: **M4 (generator)**: pick a template, start date and length in the new-planner form (live page count), and the full planner is generated: calendar months, Monday-owned weeks, daily spreads, quotes dealt by date. Changing the dates regenerates the planner and keeps edits. Earlier: M3 therapeutic pages, M2 internationalisation, M1 print model. See the delivery plan in the design doc, §14.
