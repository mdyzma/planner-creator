# ADR-0005: Translations stored inside each content record (`LocalizedText`)

Status: Proposed · Date: 2026-09-24

## Context
The brief models text as `LocalizedText { en, pl }` but proposes per-locale content files
(`quotes.en.json`, `quotes.pl.json`). The editor must show side-by-side translations and report
missing ones.

## Decision
Content files hold one record per item with `text: LocalizedText` (`quotes.json`, `prompts.json` …).
`LocalizedText` is `Partial<Record<Locale, string>>`; absence means "untranslated". UI strings are
separate (`apps/web/messages/{en,pl}.json`, next-intl). Translator hand-off (CSV/XLIFF per locale)
is export/import tooling, not the storage format.

## Alternatives
- **Per-locale files keyed by id** — familiar to translators, but ids drift, deletions desync, and
  "missing translation" requires cross-file joins.

## Consequences
+ Adding a locale = extend the `Locale` union and fill fields; scanner reports gaps.
− Diffs mix languages in one file (acceptable; records are small).
