import type { ContentItem } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import {
  exportItemsCsv,
  filterItems,
  importItemsCsv,
  nextItemId,
  normalizeText,
  parseCsv,
  validateItems,
} from '../src';

const item = (
  id: string,
  en: string,
  pl: string,
  extra: Partial<ContentItem> = {},
): ContentItem => ({
  id,
  kind: 'quote',
  text: { en, pl },
  license: 'original',
  categories: [],
  tags: [],
  ...extra,
});

describe('validateItems', () => {
  it('flags missing translations, length, licence, attribution and duplicates', () => {
    const items = [
      item('q-1', 'One day at a time.', 'Dzień po dniu.'),
      item('q-2', 'One day at a time!', ''),
      item('q-3', 'x'.repeat(130), 'y'.repeat(170)),
      item('q-4', 'Borrowed.', 'Pożyczone.', { license: 'user' }),
      item('q-5', 'Shared.', 'Udostępnione.', { license: 'cc-by' }),
      item('q-1', 'Other.', 'Inne.'),
    ];
    const codes = validateItems(items).map(
      (i) => `${i.itemId}:${i.code}${i.locale ? `:${i.locale}` : ''}:${i.severity}`,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        'q-2:missing-translation:pl:error',
        'q-3:too-long-for-a5:en:warning',
        'q-3:too-long:pl:error',
        'q-4:not-shippable:warning',
        'q-5:needs-attribution:error',
        'q-1:duplicate-id:error',
        'q-2:duplicate:en:warning',
      ]),
    );
    expect(
      validateItems(items, { forShipping: true }).find((i) => i.itemId === 'q-4')?.severity,
    ).toBe('error');
  });

  it('accepts a clean library', () => {
    expect(validateItems([item('q-1', 'Calm.', 'Spokój.')])).toEqual([]);
  });

  it('normalises for duplicate checks: case, punctuation, quotation marks, diacritics', () => {
    expect(normalizeText('„Jeden dzień!”')).toBe(normalizeText('jeden dzien'));
    expect(normalizeText('Łódź')).toBe('lodz');
  });
});

describe('ids and filters', () => {
  const items = [
    item('q-0007', 'Patience.', 'Cierpliwość.', { categories: ['patience'], tags: ['calm'] }),
    item('q-0012', 'Courage.', 'Odwaga.', { categories: ['courage'], author: 'Ann' }),
    item('a-0001', 'I am enough.', 'Wystarczam.', { kind: 'affirmation' }),
  ];

  it('picks the next free id per prefix', () => {
    expect(nextItemId(items)).toBe('q-0013');
    expect(nextItemId(items, 'a-')).toBe('a-0002');
    expect(nextItemId([], 'p-')).toBe('p-0001');
  });

  it('filters by kind, text in either language or author, category and tag', () => {
    const ids = (f: Parameters<typeof filterItems>[1]) => filterItems(items, f).map((i) => i.id);
    expect(ids({ kind: 'quote' })).toEqual(['q-0007', 'q-0012']);
    expect(ids({ query: 'odwaga' })).toEqual(['q-0012']);
    expect(ids({ query: 'ann' })).toEqual(['q-0012']);
    expect(ids({ query: 'CIERPLIWOSC' })).toEqual(['q-0007']);
    expect(ids({ category: 'patience' })).toEqual(['q-0007']);
    expect(ids({ tag: 'calm' })).toEqual(['q-0007']);
  });
});

describe('CSV', () => {
  it('parses quoted fields, escaped quotes, CRLF and a BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('detects the semicolons Polish Excel uses', () => {
    expect(parseCsv('en;pl\nOne;Jeden\n')).toEqual([
      ['en', 'pl'],
      ['One', 'Jeden'],
    ]);
  });

  it('imports rows, generating ids and marking rows without a licence as not shippable', () => {
    const csv =
      'EN;PL;license;categories\n"Keep going.";"Idź dalej.";original;recovery|courage\nOnly English;;;\n';
    const { items, errors } = importItemsCsv(csv, { existing: [item('q-0012', 'a', 'b')] });
    expect(errors).toEqual([]);
    expect(items).toEqual([
      item('q-0013', 'Keep going.', 'Idź dalej.', { categories: ['recovery', 'courage'] }),
      {
        id: 'q-0014',
        kind: 'quote',
        text: { en: 'Only English' },
        license: 'user',
        categories: [],
        tags: [],
      },
    ]);
  });

  it('reports bad rows by spreadsheet line and rejects files without text columns', () => {
    const { items, errors } = importItemsCsv('en,license\nFine,original\nBad,stolen\n');
    expect(items).toHaveLength(1);
    expect(errors).toEqual([{ line: 3, message: expect.stringContaining('license') }]);
    expect(importItemsCsv('id,author\n1,A\n').errors[0]?.message).toContain('"en" or "pl"');
  });

  it('round-trips through export and import', () => {
    const items = [
      item('q-0001', 'He said "stay".', 'Powiedział: „zostań”, a ja zostałem.', {
        author: 'A, B',
        categories: ['acceptance'],
        tags: ['stay', 'home'],
        scope: { months: [1, 2] },
      }),
    ];
    const csv = exportItemsCsv(items);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(importItemsCsv(csv).items).toEqual(items);
  });
});
