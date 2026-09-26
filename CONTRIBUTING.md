# Contributing to YAPCO

Thank you for helping. YAPCO is a small project with one maintainer, so short, focused changes
are the easiest to review. For anything larger than a fix, open an issue first so we can agree on
the approach.

## Ways to help

- **Report a problem**: open an issue with the planner settings (template, edition, format,
  language), what you expected and what you saw. A screenshot or the page number helps.
- **Improve the planner content**: wording, translations, prompts, quotes and examples. Content
  suggestions from people who use paper planners, or work in therapy, are especially welcome.
- **Fix bugs or add features**: see the [roadmap](docs/roadmap.md) for what is planned.

## Set-up

You need Node.js 24 (see `.nvmrc`; 22+ works), pnpm through Corepack, and Google Chrome for the
PDF export.

```bash
corepack enable
pnpm install
pnpm dev          # app on http://localhost:3000, PDF export service on :8787
```

## Before you open a pull request

```bash
pnpm check        # lint, typecheck, tests and build: the same as CI
```

- Keep `pnpm check` green. CI runs the same command on every push.
- Add or update tests with the change. Tests use Vitest and live next to each package in
  `test/`.
- Layout and content changes: the end-to-end tests need the built web app
  (`pnpm --filter @planner/web build`, then `pnpm --filter @planner/export-node test:e2e`). They
  include PDF export and an overflow check that renders every page of one month in each edition
  and format, with the example filling, and fails when printed text is cut off. CI runs them too.
- Format with Prettier (`pnpm format`). ESLint and TypeScript run in strict mode.

## Conventions

**Commits.** Short [Conventional Commits](https://www.conventionalcommits.org/) subjects in the
imperative, with a scope when it helps:

```text
feat(template): "worth remembering tomorrow" on the evening page
fix(export): keep page numbers on filler pages
docs: roadmap after v0.6.0
```

**Two languages, always.** Every user-facing text exists in English and Polish:

- template text as `L('English', 'Polski')` (a `LocalizedText`), one record for both languages;
- app interface strings in `apps/web/messages/en.json` and `pl.json`, with the same keys;
- Polish wording that depends on gender uses `{g:masculine|feminine}`, e.g. `{g:gotowy|gotowa}`.

**Physical units.** Page layout is in millimetres and type in points. Nothing is measured in
screen pixels.

**Privacy.** Planner data stays in the browser. Do not add analytics, accounts or anything that
sends planner content to a server.

**Architecture decisions.** A change to the data model, the print pipeline or the deployment
gets an ADR in [docs/adr/](docs/adr/) (copy the format of the latest one).

## Common tasks

### Change the "Day by Day" template

The template is written in TypeScript and compiled to JSON:

1. Edit `templates/therapeutic-recovery/src/template.ts`.
2. Every page needs an example and guide text in `src/samples.ts`, in both languages.
3. Rebuild: `pnpm --filter @planner/template-therapeutic-recovery build:template`. A test fails
   when `template.json` is out of date.
4. Check the page in the preview with the example filling on, in A4 and A5, and with the
   modules that affect it switched on and off.

Wording that only suits the recovery edition belongs in the `recovery` module (see
[ADR-0010](docs/adr/0010-modules-presets-and-block-variants.md)). A test renders every Balance
page and fails if recovery or therapy words appear.

### Add a block type

1. Define it with `defineBlock` in `packages/planner-blocks/src/blocks/` (type, props schema,
   defaults, inspector fields, `Render`).
2. Add it to `BUILT_IN_BLOCKS` in `packages/planner-blocks/src/index.ts`.
3. The designer builds the properties panel from the inspector fields; no editor code needed.
4. Add tests in `packages/planner-blocks/test/`.

### Edit quotes and other content

Quotes live in `templates/therapeutic-recovery/content/quotes.json`. To edit them in a
spreadsheet:

```bash
pnpm --filter @planner/template-therapeutic-recovery quotes:export   # to CSV
pnpm --filter @planner/template-therapeutic-recovery quotes:import   # back to JSON
```

Only add quotes you are allowed to share: your own words, public domain, or with the licence and
source filled in. The content checks flag missing translations, length and duplicates. Keep a quote
to 100 characters, so it fits the small box beside the date in A4. A quote that only suits the
recovery module lists it: `"modules": ["recovery"]`.

## Licence

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
