import type { PageInstance, PageTemplate, SectionNode } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import { pageLabels, paginate, toRoman } from '../src';

const body = { kind: 'stack' as const, gap: 0, children: [] };
const templates: Record<string, PageTemplate> = {
  page: { id: 'page', name: {}, body },
  cover: { id: 'cover', name: {}, body, hidePageNumber: true },
};
const page = (key: string, templateId = 'page'): PageInstance => ({
  key,
  templateId,
  context: {},
  enabled: true,
  origin: 'generated',
});
const section = (
  key: string,
  children: SectionNode['children'],
  extra: Partial<SectionNode> = {},
): SectionNode => ({ key, title: {}, enabled: true, sheetAligned: true, children, ...extra });

describe('pageLabels', () => {
  it('numbers front matter in roman, months from 1, the crisis section S1…', () => {
    const root: SectionNode = {
      key: 'root',
      title: {},
      enabled: true,
      children: [
        section('intro', [page('cover', 'cover'), page('how'), page('contract')], {
          numbering: { style: 'roman' },
        }),
        section('month:1', [page('m1a'), page('m1b'), page('m1c')]),
        section('month:2', [page('m2a'), page('m2b')]),
        section('crisis', [page('sos'), page('signs')], {
          numbering: { style: 'arabic', prefix: 'S', restart: true },
        }),
      ],
    };
    const { pages } = paginate(root, { templates, padTo: 2 });
    const labels = pageLabels(pages, root, templates);
    const shown = pages.map(
      (p, i) =>
        `${p.instance?.key ?? '(filler)'}=${labels[i]!.text}${labels[i]!.printed ? '' : '*'}`,
    );
    expect(shown).toEqual([
      'cover=i*', // counted, not printed
      'how=ii',
      'contract=iii',
      '(filler)=iv*', // the back of the last intro sheet
      'm1a=1',
      'm1b=2',
      'm1c=3',
      '(filler)=4*',
      'm2a=5',
      'm2b=6',
      'sos=S1',
      'signs=S2',
    ]);
  });

  it('defaults to arabic from the first page, and can leave sections unnumbered', () => {
    const root = section('root', [
      section('a', [page('a1'), page('a2')]),
      section('b', [page('b1'), page('b2')], { numbering: { style: 'none' } }),
    ]);
    const labels = pageLabels(paginate(root, { templates }).pages, root, templates);
    expect(labels.map((l) => l.text)).toEqual(['1', '2', '', '']);
    expect(labels.map((l) => l.printed)).toEqual([true, true, false, false]);
  });

  it('writes roman numerals', () => {
    expect([1, 4, 9, 14, 40, 90, 400, 1994].map(toRoman)).toEqual([
      'i',
      'iv',
      'ix',
      'xiv',
      'xl',
      'xc',
      'cd',
      'mcmxciv',
    ]);
  });
});
