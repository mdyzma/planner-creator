# Dzień po Dniu / Day by Day

The first planner template: a bilingual (English/Polish) planner for 1–12 months, printed blank and
filled in by hand. Two editions: **Recovery Edition** (recovery from addiction) and **Balance**
(everyday life, without addiction and therapy wording); see Modules below. Design background: [system design](../../docs/architecture/system-design.md)
§5.3 (daily spread), §6 (blocks), §12 (structure).

## Modules

The template declares modules and presets ([ADR-0010](../../docs/adr/0010-modules-presets-and-block-variants.md)); a planner chooses them when it is made, or later in the preview.

| Module | Default | What it controls |
|---|---|---|
| `start` | on | "Na dobry początek": six front matter pages (agreement, good life, more / less, values, strengths, recharge) |
| `recovery` | on | sobriety day counter, craving in the check-ins, triggers, AA and group markers, contract and safety rules, the crisis section, recovery wording (Balance wording is in block variants) |
| `halt` | on | HALT-B on the day page and in "My week", and its sentence on the how-to page |
| `cbt` | off | the weekly situation analysis page |
| `dayplus` | off | "Dzień+": the rest of "My 24 hours" and one important and one pleasant thing on the day page, in place of the plan of the day |
| `mindful` | off | "Praktyki uważności" (four short practices) at the front, and "Moja praktyka uważności" after each "My week": practices ticked per day, one impulse watched. Without the CBT page it takes the place of the blank page, so it adds no paper |
| `productivity` | off | a "Moje projekty" spread after each month opening (projects and next steps; focus blocks, not-to-do, notes), and on the week spread a focus block and "Nie robię w tym tygodniu" instead of the watch-out box |

Presets: **Recovery Edition** = start + recovery + halt; **Balance** = start + halt. In `src/template.ts`, `needs(block, module)` hides a block without a module and `varies(block, { when, props })` rewords it; `BALANCE` is the condition "recovery module off".

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
| Introduction (whole sheets, roman numbers) | cover · how to use · "A good start" (start module): agreement with myself · vision of a good life · more / less · values · strengths · what restores me · therapeutic contract and safety rules (recovery module) |
| Each month (whole sheets, starts on a right-hand page) | month divider · month opening spread (calendar split Mon–Thu / Fri–Sun, intention, goals, focus, appointments) · per week: weekly spread (goals, an if–then plan and what to watch out for in the outer column, Mon–Sun strips with event markers) · per day: daily spread (left: date, sobriety day, quote, morning check-in and one-line commitment, three priorities, 06:00–22:00 schedule, HALT-B; right: check-out and tick lists for triggers and protection in the outer column (A4), what was hard, dot-grid reflection, small victory, good life, gratitude) · end of each week: "My week" review spread with the situation analysis (CBT module) · Wheel of Life · monthly review · notes |
| Crisis and relapse prevention (whole sheets, recovery module) | plan for a hard moment (stop, SOBER, contacts, change the situation) · alarm thresholds for craving · emergency list and the craving wave · warning signs with a threshold · relapse chain · plan after a slip · gains and losses · support network · two craving cards |

A5 uses the same pages with fewer lines where space runs out (`formatOverrides.A5`): one schedule
line per hour, one sub-line per priority, a shorter HALT table and calendar.

## Wording

- Gendered Polish forms use whole-word tokens, `{g:wdzięczny|wdzięczna}`, printed according to the
  project setting (slash, feminine, masculine or neutral). Prefer gender-neutral phrasing where it
  reads naturally, e.g. "Nie zostawaj w samotności z głodem."
- `{{monthName}}`, `{{weekRange}}` and `{{sobrietyDayNumber}}` are filled per page; anything unset
  prints as a line to write on.
- Emergency numbers are never pre-filled; the safety page refers to "your local emergency number".
