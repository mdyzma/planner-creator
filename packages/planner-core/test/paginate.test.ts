import type { PageInstance, PageTemplate, SectionNode } from '@planner/schema';
import { isPageInstance } from '@planner/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { paginate, sideOfIndex, toSpreads } from '../src';

const body = { kind: 'stack' as const, gap: 0, children: [] };
const templates: Record<string, PageTemplate> = {
  single: { id: 'single', name: {}, body },
  spreadL: { id: 'spreadL', name: {}, body, spread: { group: 'g', position: 'left' } },
  spreadR: { id: 'spreadR', name: {}, body, spread: { group: 'g', position: 'right' } },
};

const page = (key: string, templateId = 'single', enabled = true): PageInstance => ({
  key,
  templateId,
  context: {},
  enabled,
  origin: 'generated',
});
const section = (
  key: string,
  children: SectionNode['children'],
  extra: Partial<SectionNode> = {},
): SectionNode => ({ key, title: {}, enabled: true, children, ...extra });

const keysAndSides = (root: SectionNode, padTo: 1 | 2 | 4 = 1) =>
  paginate(root, { templates, padTo }).pages.map(
    (p) => `${p.instance?.key ?? `(${p.filler})`}:${p.side[0]}`,
  );

describe('paginate: examples', () => {
  it('starts on a right-hand page and alternates', () => {
    expect(keysAndSides(section('root', [page('a'), page('b'), page('c')]))).toEqual([
      'a:r',
      'b:l',
      'c:r',
    ]);
  });

  it('inserts one filler so a spread starts on the left', () => {
    const root = section('root', [
      page('cover'),
      page('x'),
      page('dL', 'spreadL'),
      page('dR', 'spreadR'),
    ]);
    expect(keysAndSides(root)).toEqual(['cover:r', 'x:l', '(align):r', 'dL:l', 'dR:r']);
  });

  it('makes sheet-aligned months whole sheets, fillers belonging to the right section', () => {
    const root = section('root', [
      page('intro'),
      section('m1', [page('m1a'), page('m1b'), page('m1c')], { sheetAligned: true }),
      section('m2', [page('m2a')], { sheetAligned: true }),
    ]);
    const { pages } = paginate(root, { templates });
    expect(pages.map((p) => `${p.instance?.key ?? `(${p.filler})`}:${p.side[0]}`)).toEqual([
      'intro:r',
      '(align):l',
      'm1a:r',
      'm1b:l',
      'm1c:r',
      '(sheet-end):l',
      'm2a:r',
      '(sheet-end):l',
    ]);
    expect(pages[1]?.sectionPath).toEqual(['root']); // back of the intro sheet
    expect(pages[5]?.sectionPath).toEqual(['root', 'm1']); // back of month 1's last sheet
  });

  it('skips disabled pages and sections, and empty sections add no fillers', () => {
    const root = section('root', [
      page('a'),
      page('off', 'single', false),
      section('hidden', [page('h')], { enabled: false }),
      section('empty', [page('x', 'single', false)], { sheetAligned: true }),
      page('b'),
    ]);
    expect(keysAndSides(root)).toEqual(['a:r', 'b:l']);
  });

  it('pads to whole duplex sheets and to 2-up multiples', () => {
    const root = section('root', [page('a'), page('b'), page('c')]);
    expect(keysAndSides(root, 2)).toEqual(['a:r', 'b:l', 'c:r', '(pad):l']);
    expect(paginate(root, { templates, padTo: 4 }).pages).toHaveLength(4);
  });

  it('warns about unknown templates but keeps the page', () => {
    const { pages, warnings } = paginate(section('root', [page('a', 'nope')]), { templates });
    expect(pages).toHaveLength(1);
    expect(warnings).toEqual([{ code: 'unknown-template', pageKey: 'a', templateId: 'nope' }]);
  });

  it('groups pages into book spreads', () => {
    const { pages } = paginate(section('root', [page('a'), page('b'), page('c'), page('d')]), {
      templates,
    });
    expect(toSpreads(pages).map((s) => [s.left?.instance?.key, s.right?.instance?.key])).toEqual([
      [undefined, 'a'],
      ['b', 'c'],
      ['d', undefined],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Properties over random documents.

let keyCounter = 0;
const uniqueKey = fc.constant(null).map(() => `k${++keyCounter}`);

const pageArb = fc.record({
  key: uniqueKey,
  templateId: fc.constantFrom('single', 'spreadL', 'spreadR'),
  context: fc.constant({}),
  enabled: fc.boolean(),
  origin: fc.constant('generated' as const),
});

const sectionArb: fc.Arbitrary<SectionNode> = fc.letrec((tie) => ({
  section: fc.record({
    key: uniqueKey,
    title: fc.constant({}),
    enabled: fc.boolean(),
    startOn: fc.constantFrom('left', 'right', 'any', undefined),
    sheetAligned: fc.boolean(),
    children: fc.array(
      fc.oneof({ depthSize: 'small', withCrossShrink: true }, pageArb, tie('section')),
      { maxLength: 5 },
    ),
  }) as fc.Arbitrary<SectionNode>,
})).section as fc.Arbitrary<SectionNode>;

const rootArb = sectionArb.map((s) => ({ ...s, key: 'root', enabled: true }));

function enabledPagesInOrder(node: SectionNode): string[] {
  if (!node.enabled) return [];
  return node.children.flatMap((c) =>
    isPageInstance(c) ? (c.enabled ? [c.key] : []) : enabledPagesInOrder(c),
  );
}

function allSections(node: SectionNode): SectionNode[] {
  return [node, ...node.children.flatMap((c) => (isPageInstance(c) ? [] : allSections(c)))];
}

describe('paginate: properties', () => {
  const padTo = fc.constantFrom(1 as const, 2 as const, 4 as const);

  it('keeps every enabled page, in order, on alternating sides', () => {
    fc.assert(
      fc.property(rootArb, padTo, (root, pad) => {
        const { pages } = paginate(root, { templates, padTo: pad });
        pages.forEach((p, i) => {
          expect(p.index).toBe(i);
          expect(p.number).toBe(i + 1);
          expect(p.side).toBe(sideOfIndex(i));
        });
        expect(pages.flatMap((p) => (p.instance ? [p.instance.key] : []))).toEqual(
          enabledPagesInOrder(root),
        );
        expect(pages.length % pad).toBe(0);
      }),
    );
  });

  // Two alignment fillers in a row only happen for contradictory nesting (a section that must
  // start left containing one that must start on a new sheet); the M4 generator rejects those.
  it('puts spread pages on their side', () => {
    fc.assert(
      fc.property(rootArb, (root) => {
        const { pages } = paginate(root, { templates });
        for (const p of pages) {
          const spread = p.instance && templates[p.instance.templateId]?.spread;
          if (spread) expect(p.side).toBe(spread.position);
        }
      }),
    );
  });

  it('gives sheet-aligned sections whole sheets and startOn sections their side', () => {
    fc.assert(
      fc.property(rootArb, (root) => {
        const { pages } = paginate(root, { templates });
        for (const s of allSections(root)) {
          const own = pages.filter((p) => p.sectionPath.includes(s.key));
          if (own.length === 0) continue;
          const first = own[0]!;
          const last = own.at(-1)!;
          // Pages of a section are contiguous.
          expect(last.index - first.index + 1).toBe(own.length);
          if (s.sheetAligned) {
            expect(first.side).toBe('right');
            expect(last.side).toBe('left');
          } else if (s.startOn === 'left' || s.startOn === 'right') {
            expect(first.side).toBe(s.startOn);
          }
        }
      }),
    );
  });
});
