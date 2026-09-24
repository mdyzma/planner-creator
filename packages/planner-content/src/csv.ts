import type { ContentItem, ContentKind } from '@planner/schema';
import { ContentItem as ContentItemSchema } from '@planner/schema';
import { nextItemId } from './validate';

/**
 * Spreadsheet import/export for content libraries, so quotes can be written in Excel or Google
 * Sheets (§4.5.1). One row per item, both languages side by side:
 *
 *   id, kind, en, pl, author, source, license, categories, tags, months
 *
 * Only `en` or `pl` is required; lists use `|` (e.g. `recovery|patience`).
 */
export const CSV_COLUMNS = [
  'id',
  'kind',
  'en',
  'pl',
  'author',
  'source',
  'license',
  'categories',
  'tags',
  'months',
] as const;

/** Splits CSV text into rows (RFC 4180 quoting, CRLF or LF, comma or semicolon). */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Polish Excel saves CSV with semicolons; pick whichever appears more in the header line. */
function detectDelimiter(text: string): ',' | ';' {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (c: string) => header.split(c).length - 1;
  return count(';') > count(',') ? ';' : ',';
}

export interface CsvImportError {
  /** 1-based line number in the spreadsheet (the header is line 1). */
  line: number;
  message: string;
}

export interface CsvImportResult {
  items: ContentItem[];
  errors: CsvImportError[];
}

const list = (cell: string | undefined) =>
  (cell ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Reads items from a spreadsheet. Rows without an id get the next free one. Rows without a
 * licence are marked `user` (may not ship in a template) — a licence has to be stated explicitly.
 */
export function importItemsCsv(
  text: string,
  options: { existing?: readonly ContentItem[]; defaultKind?: ContentKind; idPrefix?: string } = {},
): CsvImportResult {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  if (!header) return { items: [], errors: [{ line: 1, message: 'The file is empty.' }] };

  const columns = header.map((h) => h.trim().toLowerCase());
  const at = (name: (typeof CSV_COLUMNS)[number]) => columns.indexOf(name);
  if (at('en') < 0 && at('pl') < 0) {
    return { items: [], errors: [{ line: 1, message: 'Missing an "en" or "pl" column.' }] };
  }

  const items: ContentItem[] = [];
  const errors: CsvImportError[] = [];
  body.forEach((cells, r) => {
    const line = r + 2;
    const get = (name: (typeof CSV_COLUMNS)[number]) => {
      const i = at(name);
      return i < 0 ? undefined : cells[i]?.trim() || undefined;
    };
    const text: ContentItem['text'] = {};
    if (get('en')) text.en = get('en');
    if (get('pl')) text.pl = get('pl');
    const months = list(get('months')).map(Number);

    const candidate = {
      id: get('id') ?? nextItemId([...(options.existing ?? []), ...items], options.idPrefix),
      kind: get('kind') ?? options.defaultKind ?? 'quote',
      text,
      ...(get('author') ? { author: get('author') } : {}),
      ...(get('source') ? { source: get('source') } : {}),
      license: get('license') ?? 'user',
      categories: list(get('categories')),
      tags: list(get('tags')),
      ...(months.length > 0 ? { scope: { months } } : {}),
    };
    const parsed = ContentItemSchema.safeParse(candidate);
    if (parsed.success) {
      items.push(parsed.data);
    } else {
      const issue = parsed.error.issues[0]!;
      errors.push({ line, message: `${issue.path.join('.') || 'row'}: ${issue.message}` });
    }
  });
  return { items, errors };
}

const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;

/**
 * Writes items as CSV with a UTF-8 byte-order mark, so Excel opens Polish characters correctly.
 */
export function exportItemsCsv(items: readonly ContentItem[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const item of items) {
    lines.push(
      [
        item.id,
        item.kind,
        item.text.en ?? '',
        item.text.pl ?? '',
        item.author ?? '',
        item.source ?? '',
        item.license,
        item.categories.join('|'),
        item.tags.join('|'),
        (item.scope?.months ?? []).join('|'),
      ]
        .map(cell)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
