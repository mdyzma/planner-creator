import type { Locale } from '@planner/schema';

/**
 * Calendar formatting for planner pages. Dates are ISO `YYYY-MM-DD` strings without time zones,
 * so every formatter works in UTC and never shifts a day.
 */
const toDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

const format = (iso: string, locale: Locale, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(toDate(iso));

/**
 * Month name. Polish inflects it: the standalone (nominative) form heads a month page,
 * "październik"; inside a date it takes the genitive, "1 października" (§7).
 */
export function formatMonth(iso: string, locale: Locale, form: 'standalone' | 'with-year'): string {
  const text =
    form === 'with-year'
      ? format(iso, locale, { month: 'long', year: 'numeric' })
      : format(iso, locale, { month: 'long' });
  return capitalize(text, locale);
}

export type DateStyle = 'day-month' | 'weekday-day-month' | 'full';

export function formatDate(iso: string, locale: Locale, style: DateStyle): string {
  const options: Record<DateStyle, Intl.DateTimeFormatOptions> = {
    'day-month': { day: 'numeric', month: 'long' },
    'weekday-day-month': { weekday: 'long', day: 'numeric', month: 'long' },
    full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  };
  return capitalize(format(iso, locale, options[style]), locale);
}

export function weekdayName(iso: string, locale: Locale, width: 'long' | 'short' = 'long'): string {
  return capitalize(format(iso, locale, { weekday: width }), locale);
}

/** Weekday names Monday → Sunday, for calendar headers. */
export function weekdayNames(
  locale: Locale,
  width: 'long' | 'short' | 'narrow' = 'short',
): string[] {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    capitalize(format(`2024-01-0${i + 1}`, locale, { weekday: width }), locale),
  );
}

/** ISO-8601 week number (weeks start on Monday; week 1 contains the first Thursday). */
export function isoWeekNumber(iso: string): number {
  const date = toDate(iso);
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/** Headings start with a capital letter in both languages; Polish Intl output is lower case. */
const capitalize = (s: string, locale: Locale) =>
  s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
