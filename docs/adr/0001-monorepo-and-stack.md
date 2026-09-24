# ADR-0001: pnpm + Turborepo monorepo, Next.js client-heavy app

Status: Proposed · Date: 2026-09-24

## Context
The brief separates engine concerns (schema, generator, renderer, PDF) from the app and requires new
planner types without engine changes. The team is small; the preferred stack is Next.js, React,
TypeScript, Tailwind, shadcn/ui, Zustand, Zod, dnd-kit.

## Decision
- pnpm workspaces + Turborepo; packages under `packages/planner-*`, apps under `apps/`.
- Strict inward dependency rule: `schema ← i18n ← core ← {generator, content, blocks, renderer} ← pdf ← apps`.
  Enforced with `eslint-plugin-boundaries` (or dependency-cruiser) in CI.
- Next.js App Router, but project data is client-side only (IndexedDB); no server actions on project data.
- `next-intl` for UI strings; `date-fns` for calendar maths; Dexie for IndexedDB.

## Alternatives
- **Single Next.js app with folders** — simpler start, but nothing prevents the renderer importing
  therapeutic specifics; the export worker would need to import the whole app.
- **Vite SPA** — lighter and a good fit for a local-first tool; rejected only because Next.js is the
  stated preference and gives i18n routing + a place for future server features.

## Consequences
+ Engine packages are testable in isolation and reusable by the export worker.
− More build config (tsconfig references, package exports).
