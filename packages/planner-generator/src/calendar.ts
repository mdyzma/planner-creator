import { addDays, addMonths, formatDate, formatMonth } from '@planner/i18n';
import type { GenerationConfig, LocalizedText } from '@planner/schema';
import { LOCALES } from '@planner/schema';

/**
 * Calendar planning for the generator (§12). Dates are ISO `YYYY-MM-DD` strings in UTC.
 * Keys are derived from dates (not positions), so a page keeps its key — and its edits — when
 * the planner is regenerated with a different start date.
 */

export interface MonthBlock {
  index: number;
  key: string;
  title: LocalizedText;
  /** Date for page context: the first day of the calendar month (drives calendars, {{monthName}}). */
  date?: string;
  /** Days of this block inside the planner. */
  start?: string;
  end?: string;
  weeks: WeekBlock[];
}

export interface WeekBlock {
  index: number;
  key: string;
  title: LocalizedText;
  /** Monday … Sunday, including days outside the planner (greyed on the weekly spread). */
  dates?: string[];
  /** Days of this week inside the planner, in order. */
  days: string[];
}

const byLocale = (fn: (locale: (typeof LOCALES)[number]) => string): LocalizedText =>
  Object.fromEntries(LOCALES.map((l) => [l, fn(l)])) as LocalizedText;

const weekdayIndex = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7; // Monday = 0
};
export const mondayOf = (iso: string) => addDays(iso, -weekdayIndex(iso));
const monthKey = (iso: string) => iso.slice(0, 7);
const firstOfMonth = (iso: string) => `${monthKey(iso)}-01`;
const lastOfMonth = (iso: string) => addDays(addMonths(firstOfMonth(iso), 1), -1);
const minDate = (a: string, b: string) => (a < b ? a : b);
const maxDate = (a: string, b: string) => (a > b ? a : b);

/** Last planner day: start + duration − 1 day. */
export const endDateOf = (config: GenerationConfig): string | undefined =>
  config.startDate ? addDays(addMonths(config.startDate, config.durationMonths), -1) : undefined;

const UNDATED_WEEKS_PER_MONTH = 4;

/**
 * Month blocks with their weeks.
 * - `calendar` months: every calendar month touched by the planner gets its own block, however
 *   short (decided 2026-09-24).
 * - `rolling` months: month n runs from start + n months (programmes counting from admission).
 * - Weeks start on Monday and belong to the month of their Monday (or Thursday, with
 *   `iso-thursday`); the week containing the start date always belongs to the first month.
 * - Undated planners get four undated weeks per month.
 */
export function planMonths(config: GenerationConfig): MonthBlock[] {
  const start = config.startDate;
  const end = endDateOf(config);
  if (!start || !end) return planUndated(config.durationMonths);

  const months: Omit<MonthBlock, 'weeks'>[] = [];
  if (config.monthMode === 'rolling') {
    for (let i = 0; i < config.durationMonths; i++) {
      const s = addMonths(start, i);
      const e = addDays(addMonths(start, i + 1), -1);
      months.push({
        index: i,
        key: `month:r${i + 1}`,
        title: byLocale(
          (l) => `${formatDate(s, l, 'day-month')} – ${formatDate(e, l, 'day-month')}`,
        ),
        date: s,
        start: s,
        end: e,
      });
    }
  } else {
    for (let m = firstOfMonth(start); m <= end; m = addMonths(m, 1)) {
      months.push({
        index: months.length,
        key: `month:${monthKey(m)}`,
        title: byLocale((l) => formatMonth(m, l, 'with-year')),
        date: m,
        start: maxDate(m, start),
        end: minDate(lastOfMonth(m), end),
      });
    }
  }

  const weeksByMonth = new Map<number, WeekBlock[]>(months.map((m) => [m.index, []]));
  for (let monday = mondayOf(start); monday <= end; monday = addDays(monday, 7)) {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const anchor = config.weekOwnership === 'iso-thursday' ? dates[3]! : monday;
    // The week belongs to the block containing its anchor day, clamped to the planner's months.
    let owner = months.findIndex((m) => anchor >= m.start! && anchor <= m.end!);
    if (owner < 0) owner = anchor < start ? 0 : months.length - 1;
    const list = weeksByMonth.get(owner)!;
    list.push({
      index: list.length,
      key: `week:${monday}`,
      title: byLocale(
        (l) =>
          `${formatDate(dates[0]!, l, 'day-month')} – ${formatDate(dates[6]!, l, 'day-month')}`,
      ),
      dates,
      days: dates.filter((d) => d >= start && d <= end),
    });
  }

  return months.map((m) => ({ ...m, weeks: weeksByMonth.get(m.index)! }));
}

function planUndated(count: number): MonthBlock[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    key: `month:${i + 1}`,
    title: { en: `Month ${i + 1}`, pl: `Miesiąc ${i + 1}` },
    weeks: Array.from({ length: UNDATED_WEEKS_PER_MONTH }, (_, w) => ({
      index: w,
      // Keys are global (not nested under the month), so they carry the month number too.
      key: `week:${i + 1}.${w + 1}`,
      title: { en: `Week ${w + 1}`, pl: `Tydzień ${w + 1}` },
      days: [],
    })),
  }));
}

/** Days per page iteration: single days, or pairs for the two-days-per-page layout. */
export function chunkDays(days: readonly string[], group: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < days.length; i += group) chunks.push(days.slice(i, i + group));
  return chunks;
}
