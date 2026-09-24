import type { PageInstance, PageTemplate, SectionNode } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import { paginate, sectionRanges } from '../src';

const body = { kind: 'stack' as const, gap: 0, children: [] };
const templates: Record<string, PageTemplate> = { single: { id: 'single', name: {}, body } };
const page = (key: string): PageInstance => ({
  key,
  templateId: 'single',
  context: {},
  enabled: true,
  origin: 'generated',
});
const section = (key: string, n: number, extra: Partial<SectionNode> = {}): SectionNode => ({
  key,
  title: { en: key },
  enabled: true,
  children: Array.from({ length: n }, (_, i) => page(`${key}/${i}`)),
  ...extra,
});

describe('sectionRanges', () => {
  it('gives each top-level section its pages, fillers included, on whole sheets', () => {
    const root: SectionNode = {
      key: 'root',
      title: {},
      enabled: true,
      children: [
        section('intro', 3, { sheetAligned: true }),
        section('month:1', 5, { sheetAligned: true }),
        section('notes', 1),
      ],
    };
    const { pages } = paginate(root, { templates, padTo: 4 });
    const ranges = sectionRanges(pages, root);
    expect(ranges.map((r) => [r.key, r.from, r.to, r.wholeSheets])).toEqual([
      ['intro', 0, 3, true],
      ['month:1', 4, 9, true],
      // The unaligned last section starts on a right page; padding pages join it.
      ['notes', 10, 11, true],
    ]);
    expect(ranges[1]?.title).toEqual({ en: 'month:1' });
    // Every page belongs to exactly one range.
    expect(ranges.reduce((n, r) => n + r.to - r.from + 1, 0)).toBe(pages.length);
  });

  it('flags sections that do not fill whole sheets', () => {
    const root: SectionNode = {
      key: 'root',
      title: {},
      enabled: true,
      children: [section('a', 1), section('b', 2)],
    };
    const ranges = sectionRanges(paginate(root, { templates }).pages, root);
    expect(ranges.map((r) => [r.key, r.wholeSheets])).toEqual([
      ['a', false],
      ['b', false],
    ]);
  });
});
