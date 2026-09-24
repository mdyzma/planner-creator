import type { Locale, LocalizedText } from '@planner/schema';
import { LOCALES } from '@planner/schema';

/** A translation counts as present only if it has visible text. */
export const hasTranslation = (text: LocalizedText | undefined, locale: Locale): boolean =>
  (text?.[locale]?.trim() ?? '') !== '';

/** Locales in `locales` with no usable translation. */
export const missingLocales = (
  text: LocalizedText | undefined,
  locales: readonly Locale[] = LOCALES,
): Locale[] => locales.filter((l) => !hasTranslation(text, l));

/**
 * Text for `locale`, falling back to the first other locale that has a translation. Missing
 * translations are reported by the scanner, never thrown (§7).
 */
export function localize(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return '';
  if (hasTranslation(text, locale)) return text[locale]!;
  const other = LOCALES.find((l) => hasTranslation(text, l));
  return other ? text[other]! : '';
}

/** Copies one translation into another; by default only fills an empty target. */
export function copyTranslation(
  text: LocalizedText,
  from: Locale,
  to: Locale,
  { overwrite = false }: { overwrite?: boolean } = {},
): LocalizedText {
  if (!hasTranslation(text, from)) return text;
  if (!overwrite && hasTranslation(text, to)) return text;
  return { ...text, [to]: text[from] };
}

/** True for plain objects whose keys are all locales and values all strings. */
export function isLocalizedText(value: unknown): value is LocalizedText {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(([k, v]) => (LOCALES as readonly string[]).includes(k) && typeof v === 'string')
  );
}
