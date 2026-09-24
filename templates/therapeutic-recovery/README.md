# Therapeutic Recovery Planner — 6 Months

The first planner template: a bilingual (English/Polish) six-month recovery planner, printed blank
and filled in by hand. Design background: [system design](../../docs/architecture/system-design.md)
§5.3 (daily spread), §6 (blocks), §12 (structure).

## Files

| File | What it is |
|---|---|
| `src/template.ts` | The template, authored in TypeScript for type checking. **Edit this.** |
| `template.json` | Generated from `src/template.ts`; the data the app loads. Do not edit by hand. |
| `content/quotes.json` | Daily quotes, English and Polish in one record each. Only `original` or `public-domain` items may ship. |
| `test/template.test.tsx` | Keeps `template.json` in sync, validates every block in A4 and A5 in both languages, and checks that every text is translated. |

After changing `src/template.ts`:

```bash
pnpm --filter @planner/template-therapeutic-recovery build:template
pnpm --filter @planner/template-therapeutic-recovery test
```

## Pages

| Section | Pages |
|---|---|
| Introduction (whole sheets) | cover · how to use · therapeutic contract · safety rules |
| Each month (whole sheets, starts on a right-hand page) | month divider · month opening spread (calendar split Mon–Thu / Fri–Sun, intention, goals, focus, appointments) · per week: weekly spread (goals and wins in the outer column, Mon–Sun strips with event markers) · per day: daily spread (left: date, sobriety day, quote, 24-hour commitment, three priorities, 07:00–18:00 schedule, HALT; right: relapse question, dot-grid reflection, gratitude) · Wheel of Life · monthly review · notes |
| Crisis and relapse prevention (whole sheets) | SOS plan · warning signs (body, thoughts, emotions, behaviours) · gains and losses · support network |

A5 uses the same pages with fewer lines where space runs out (`formatOverrides.A5`): one schedule
line per hour, one sub-line per priority, a shorter HALT table and calendar.

## Wording

- Gendered Polish forms use whole-word tokens, `{g:wdzięczny|wdzięczna}`, printed according to the
  project setting (slash, feminine, masculine or neutral). Prefer gender-neutral phrasing where it
  reads naturally, e.g. "Nie zostawaj w samotności z głodem."
- `{{monthName}}`, `{{weekRange}}` and `{{sobrietyDayNumber}}` are filled per page; anything unset
  prints as a line to write on.
- Emergency numbers are never pre-filled; the safety page refers to "your local emergency number".
