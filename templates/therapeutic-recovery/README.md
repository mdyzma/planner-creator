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

## Writing quotes in a spreadsheet

Quotes can be written in Excel or Google Sheets, one row per quote with English and Polish side by side.

1. Export the current quotes to start from:

   ```bash
   pnpm --filter @planner/template-therapeutic-recovery quotes:export quotes.csv
   ```

2. Edit `quotes.csv`. Columns: `id, kind, en, pl, author, source, license, categories, tags, months`.
   Leave `id` empty for new rows (the next free `q-0013`… is used). Use `original` for your own
   writing and `public-domain` only when that is certain. Separate list values with `|`
   (e.g. `recovery|patience`). Saving from Polish Excel with semicolons is fine.
3. Import it back into `content/quotes.json`:

   ```bash
   pnpm --filter @planner/template-therapeutic-recovery quotes:import quotes.csv
   ```

   Nothing is written unless every quote has both languages, fits the quote box (160 characters;
   over 110 gives an A5 warning), has a shippable licence and a unique id.

Target: at least 60 quotes, so no quote repeats within 30 days across a six-month planner (the
generator deals quotes by date: a quote returns after as many days as there are quotes).
The app's **Content** screen does the same per planner: edit, import/export CSV, and re-deal.

## Pages

| Section | Pages |
|---|---|
| Introduction (whole sheets) | cover · how to use · therapeutic contract · safety rules |
| Each month (whole sheets, starts on a right-hand page) | month divider · month opening spread (calendar split Mon–Thu / Fri–Sun, intention, goals, focus, appointments) · per week: weekly spread (goals and wins in the outer column, Mon–Sun strips with event markers) · per day: daily spread (left: date, sobriety day, quote, 24-hour commitment, three priorities, 06:00–22:00 schedule, HALT-B; right: check-out and tick lists for triggers and protection in the outer column (A4), what was hard, dot-grid reflection, small victory, good life, gratitude) · optional weekly situation analysis (off by default) · Wheel of Life · monthly review · notes |
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
