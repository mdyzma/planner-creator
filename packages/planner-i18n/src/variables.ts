import type { Locale, PageContext, PlannerProject } from '@planner/schema';
import { formatDate, formatMonth, isoWeekNumber, weekdayName } from './dates';

/** What an unset variable prints as: a line to write on by hand (§4.6). */
export const HANDWRITING_BLANK = '__________';

/**
 * Replaces `{{name}}` tokens. Unknown or unset variables become a handwriting blank, never the raw
 * token, so anonymous planners print cleanly.
 */
export function fillVariables(text: string, vars: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, (_, name: string) => {
    const value = vars[name];
    return value !== undefined && value.trim() !== '' ? value : HANDWRITING_BLANK;
  });
}

const DAY_MS = 24 * 3600 * 1000;
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Adds calendar months, clamping to the month's last day (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y!, m! - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return toIso(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d!, lastDay)));
}

export const addDays = (iso: string, days: number): string => toIso(utc(iso) + days * DAY_MS);

export const daysBetween = (from: string, to: string): number =>
  Math.round((utc(to) - utc(from)) / DAY_MS);

/** Last day covered by the planner: start + duration − 1 day (§12). */
export function plannerEndDate(project: PlannerProject): string | undefined {
  const start = project.generation.startDate;
  return start ? addDays(addMonths(start, project.generation.durationMonths), -1) : undefined;
}

/**
 * Variables available to text on one page (§4.6): the page's own date context, planner-wide
 * dates, and values entered at generation. Anything absent prints as a blank line.
 */
export function pageVariables(
  project: PlannerProject,
  page: PageContext,
  locale: Locale,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, v] of Object.entries(project.generation.variables))
    vars[name] = String(v.value);

  const start = project.generation.startDate;
  const end = plannerEndDate(project);
  if (start) vars.plannerStartDate = formatDate(start, locale, 'full');
  if (end) vars.plannerEndDate = formatDate(end, locale, 'full');

  const date = page.date ?? page.dates?.[0];
  if (date) {
    vars.currentDate = formatDate(date, locale, 'full');
    vars.dayName = weekdayName(date, locale);
    vars.monthName = formatMonth(date, locale, 'with-year');
    vars.weekNumber = String(isoWeekNumber(date));
  }
  if (page.dates && page.dates.length > 0) {
    const first = page.dates[0]!;
    const last = page.dates.at(-1)!;
    vars.weekRange = `${formatDate(first, locale, 'day-month')} – ${formatDate(last, locale, 'day-month')}`;
  }

  const sobrietyStart = project.generation.variables.sobrietyStartDate?.value;
  if (date && typeof sobrietyStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sobrietyStart)) {
    const day = daysBetween(sobrietyStart, date) + 1;
    if (day >= 1) vars.sobrietyDayNumber = String(day);
  }
  return vars;
}
