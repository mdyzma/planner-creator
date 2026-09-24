import type { ContentItem, ContentKind, Locale } from '@planner/schema';
import { LOCALES } from '@planner/schema';

/**
 * Longest quote (characters) that fits the daily page's quote box: about three lines of 9 pt
 * italic in the box's width on each format (§4.5.1).
 */
export const QUOTE_LENGTH_LIMITS = { A4: 160, A5: 110 } as const;

/** Licences that may ship in a public template (§4.5.1). */
export const SHIPPABLE_LICENSES: readonly ContentItem['license'][] = ['original', 'public-domain'];

export type ContentIssueCode =
  | 'missing-translation'
  | 'too-long'
  | 'too-long-for-a5'
  | 'not-shippable'
  | 'needs-attribution'
  | 'duplicate'
  | 'duplicate-id';

export interface ContentIssue {
  itemId: string;
  code: ContentIssueCode;
  severity: 'error' | 'warning';
  locale?: Locale;
  /** For duplicates: the other item. */
  otherId?: string;
}

/** Kinds printed in a length-limited box. */
const LENGTH_LIMITED: readonly ContentKind[] = ['quote', 'affirmation'];

/**
 * Compares texts ignoring case, punctuation, quotation marks and spacing, so "„Jeden dzień.”"
 * and "jeden dzien" do not both slip into a library. Diacritics are removed too.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface ValidateOptions {
  /** Treat licences that may not ship as errors (checking a template before release). */
  forShipping?: boolean;
}

/** Checks a library's items: translations, length, licence, duplicates (§4.5.1). */
export function validateItems(
  items: readonly ContentItem[],
  options: ValidateOptions = {},
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const idCounts = new Map<string, number>();

  for (const item of items) {
    idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1);
    for (const locale of LOCALES) {
      const text = item.text[locale]?.trim() ?? '';
      if (!text) {
        issues.push({ itemId: item.id, code: 'missing-translation', severity: 'error', locale });
        continue;
      }
      if (LENGTH_LIMITED.includes(item.kind)) {
        if (text.length > QUOTE_LENGTH_LIMITS.A4) {
          issues.push({ itemId: item.id, code: 'too-long', severity: 'error', locale });
        } else if (text.length > QUOTE_LENGTH_LIMITS.A5) {
          issues.push({ itemId: item.id, code: 'too-long-for-a5', severity: 'warning', locale });
        }
      }
    }
    if (!SHIPPABLE_LICENSES.includes(item.license)) {
      issues.push({
        itemId: item.id,
        code: 'not-shippable',
        severity: options.forShipping ? 'error' : 'warning',
      });
    }
    if (item.license === 'cc-by' && !item.author?.trim() && !item.source?.trim()) {
      issues.push({ itemId: item.id, code: 'needs-attribution', severity: 'error' });
    }
  }

  for (const [id, count] of idCounts) {
    if (count > 1) issues.push({ itemId: id, code: 'duplicate-id', severity: 'error' });
  }

  for (const locale of LOCALES) {
    const seen = new Map<string, string>();
    for (const item of items) {
      const key = normalizeText(item.text[locale] ?? '');
      if (!key) continue;
      const first = seen.get(key);
      if (first !== undefined && first !== item.id) {
        issues.push({
          itemId: item.id,
          code: 'duplicate',
          severity: 'warning',
          locale,
          otherId: first,
        });
      } else {
        seen.set(key, item.id);
      }
    }
  }
  return issues;
}

/** Next free id with a prefix, e.g. "q-0013" after "q-0012". */
export function nextItemId(items: readonly ContentItem[], prefix = 'q-'): string {
  let max = 0;
  for (const item of items) {
    const match = item.id.startsWith(prefix) ? /(\d+)$/.exec(item.id) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export interface ItemFilter {
  kind?: ContentKind;
  query?: string;
  category?: string;
  tag?: string;
  /** Only items with a problem (missing translation, too long, …). */
  withIssues?: readonly ContentIssue[];
}

/** Filters items by kind, free text (both languages, author), category, tag or problems (§24). */
export function filterItems(items: readonly ContentItem[], filter: ItemFilter): ContentItem[] {
  const query = filter.query ? normalizeText(filter.query) : '';
  const flagged = filter.withIssues ? new Set(filter.withIssues.map((i) => i.itemId)) : undefined;
  return items.filter(
    (item) =>
      (!filter.kind || item.kind === filter.kind) &&
      (!filter.category || item.categories.includes(filter.category)) &&
      (!filter.tag || item.tags.includes(filter.tag)) &&
      (!flagged || flagged.has(item.id)) &&
      (!query ||
        normalizeText(
          [...LOCALES.map((l) => item.text[l] ?? ''), item.author ?? '', item.id].join(' '),
        ).includes(query)),
  );
}
