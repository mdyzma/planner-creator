# Tydzień po Tygodniu / Week by Week

The second planner template: a simple, bilingual (English/Polish) weekly planner for 1–12 months
(a year by default), in A4 or A5, printed blank and filled in by hand. Nothing therapeutic and no
modules: it exists to show that the engine is generic. It uses the same blocks and generator as
"Day by Day" and has no code of its own.

## Pages

| Section | Pages |
| --- | --- |
| Introduction (i, ii) | Cover with the YAPCO line apple and the start date; "My year" (goals for the year, what to remember, notes) |
| Each month | Month spread: the calendar and goals for the month on the left; important dates, a to-do list and notes on the right |
| Each week | Week spread: Monday–Wednesday with the week's three priorities and "Remember" in the outer column; Thursday–Sunday with a to-do list and notes |
| End of each month | A notes page with a 5 mm dot grid |

Every month starts on a new sheet, so months can be printed and filed one at a time. A week
belongs to the month its Monday falls in; the planner's first month also starts with the week
that contains its 1st, so no day is missing (a year from January 2027 starts with the week of
Monday 28 December and has 53 week spreads). In A5 the month's to-do list has six lines instead
of eight.

## Files

| File | What it is |
| --- | --- |
| `src/template.ts` | The template, authored in TypeScript. **Edit this.** |
| `template.json` | Generated from `src/template.ts`; the data the app loads. Do not edit by hand. |
| `test/template.test.tsx` | Keeps `template.json` in sync, renders every block in A4 and A5 in both languages, checks translations, and generates a year. |

After changing `src/template.ts`:

```bash
pnpm --filter @planner/template-weekly-planner build:template
pnpm --filter @planner/template-weekly-planner test
```

The overflow check (`apps/export-node/test/overflow.e2e.test.ts`) also renders one month of this
template in Chrome, in both formats and languages, and fails when printed text is cut off.

Not yet: example filling and a printable guide ("Day by Day" has both); the app hides those
options for this template.
