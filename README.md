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
packages/planner-storage Repository interfaces + IndexedDB (Dexie) and in-memory implementations
templates/               Planner templates and bilingual content (data, not code)
docs/                    Architecture, ADRs, operations, frozen demo reference
```

Status: **M0 (foundations)**. See the delivery plan in the design doc, §14.
