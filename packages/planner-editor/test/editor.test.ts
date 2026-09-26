import { findBlock, resolvePageTemplate } from '@planner/core';
import { generate } from '@planner/generator';
import type { PageInstance, PlannerProject, SectionNode } from '@planner/schema';
import { createProject, isPageInstance, parseProject, parseTemplate } from '@planner/schema';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { describe, expect, it } from 'vitest';
import {
  addBlock,
  deleteBlock,
  duplicateBlock,
  emptyHistory,
  findPage,
  moveBlock,
  moveRecipeChild,
  record,
  redo,
  resetBlockOnPage,
  setBlockFlag,
  setBlockHiddenOnPage,
  setBlockSize,
  setBlockValue,
  setPageEnabled,
  setRecipeChildEnabled,
  setSectionEnabled,
  setVariable,
  setVariantValue,
  templateUsage,
  undo,
  valueOrigin,
} from '../src';

const parsed = parseTemplate(templateJson);
if (!parsed.ok) throw new Error('template invalid');

function planner(format: 'A4' | 'A5' = 'A4'): PlannerProject {
  const p = createProject({
    id: 'p',
    name: 'Test',
    format,
    locale: 'en',
    now: '2026-09-24T00:00:00.000Z',
    template: parsed.ok ? parsed.value : (undefined as never),
  });
  const generation = { ...p.generation, startDate: '2026-10-01', durationMonths: 1 };
  const { document } = generate({
    template: p.template,
    config: generation,
    content: [],
    seed: 'p',
  });
  return { ...p, generation, document };
}

const pagesOf = (node: SectionNode): PageInstance[] =>
  node.children.flatMap((c) => (isPageInstance(c) ? [c] : pagesOf(c)));

const DAY = 'day:2026-10-05/day-left';
const PRIORITIES = { templateId: 'day-left', blockId: 'priorities' };
const propsOf = (p: PlannerProject, templateId: string, blockId: string) =>
  findBlock(p.template.pageTemplates[templateId]!, blockId)?.block.props as Record<string, unknown>;

describe('edit scope', () => {
  it('a template edit changes every page using it', () => {
    const p = setBlockValue(planner(), PRIORITIES, 'props', 'count', 2, { kind: 'template' });
    expect(propsOf(p, 'day-left', 'priorities').count).toBe(2);
    expect(valueOrigin(p, PRIORITIES, 'props', 'count')).toBe('template');
    expect(parseProject(p).ok).toBe(true);
  });

  it('a page edit is a sparse override on that page only, and can be reset', () => {
    const base = planner();
    const p = setBlockValue(base, PRIORITIES, 'props', 'count', 1, {
      kind: 'page',
      pageKey: DAY,
    });
    const page = findPage(p, DAY)!;
    expect(page.overrides).toEqual({ priorities: { props: { count: 1 } } });
    expect(valueOrigin(p, PRIORITIES, 'props', 'count', page)).toBe('page');
    expect(propsOf(p, 'day-left', 'priorities')).toEqual(propsOf(base, 'day-left', 'priorities'));
    const resolved = resolvePageTemplate(p.template.pageTemplates['day-left']!, {
      format: 'A4',
      side: 'left',
      overrides: page.overrides,
    }).template;
    expect((findBlock(resolved, 'priorities')?.block.props as { count: number }).count).toBe(1);

    const reset = resetBlockOnPage(p, DAY, 'priorities');
    expect(findPage(reset, DAY)!.overrides).toBeUndefined();
    // Resetting one value removes just that value.
    const cleared = setBlockValue(p, PRIORITIES, 'props', 'count', undefined, {
      kind: 'page',
      pageKey: DAY,
    });
    expect(findPage(cleared, DAY)!.overrides).toBeUndefined();
  });

  it('hides a block on one page', () => {
    const p = setBlockHiddenOnPage(planner(), DAY, 'halt', true);
    expect(findPage(p, DAY)!.overrides).toEqual({ halt: { hidden: true } });
    expect(findPage(setBlockHiddenOnPage(p, DAY, 'halt', false), DAY)!.overrides).toBeUndefined();
  });

  it('on A5, editing a value the A5 layout adjusts changes the adjustment, not A4', () => {
    const base = planner('A5');
    expect(valueOrigin(base, PRIORITIES, 'props', 'subLines')).toBe('format');
    const p = setBlockValue(base, PRIORITIES, 'props', 'subLines', [], { kind: 'template' });
    expect(propsOf(p, 'day-left', 'priorities').subLines).toEqual(
      propsOf(base, 'day-left', 'priorities').subLines,
    );
    const a5 = p.template.pageTemplates['day-left']!.formatOverrides!.A5!;
    expect(a5.find((op) => op.path.endsWith('/props/subLines'))?.value).toEqual([]);
  });
});

describe('block structure', () => {
  it('adds, duplicates, moves and deletes blocks with unique ids', () => {
    let p = planner();
    const added = addBlock(p, 'day-left', { type: 'divider' }, 'priorities');
    p = added.project;
    expect(added.blockId).toBe('divider');
    const dup = duplicateBlock(p, PRIORITIES);
    p = dup.project;
    expect(dup.blockId).toBe('priorities-2');
    expect(propsOf(p, 'day-left', 'priorities-2')).toEqual(propsOf(p, 'day-left', 'priorities'));

    const index = (id: string) => findBlock(p.template.pageTemplates['day-left']!, id)!.index;
    const before = index('divider');
    p = moveBlock(p, { templateId: 'day-left', blockId: 'divider' }, 0);
    expect(index('divider')).toBe(0);
    expect(before).toBeGreaterThan(0);

    p = setBlockHiddenOnPage(p, DAY, 'divider', true);
    p = deleteBlock(p, { templateId: 'day-left', blockId: 'divider' });
    expect(findBlock(p.template.pageTemplates['day-left']!, 'divider')).toBeUndefined();
    expect(findPage(p, DAY)!.overrides).toBeUndefined();
    expect(parseProject(p).ok).toBe(true);
  });

  it('locked blocks refuse changes until unlocked', () => {
    let p = setBlockFlag(planner(), PRIORITIES, 'locked', true);
    const locked = p;
    p = setBlockValue(p, PRIORITIES, 'props', 'count', 1, { kind: 'template' });
    p = deleteBlock(p, PRIORITIES);
    p = moveBlock(p, PRIORITIES, 0);
    p = setBlockSize(p, PRIORITIES, 'height', { mm: 10 });
    expect(p).toBe(locked);
    p = setBlockFlag(p, PRIORITIES, 'locked', false);
    expect(findBlock(p.template.pageTemplates['day-left']!, 'priorities')?.block.locked).toBe(
      undefined,
    );
  });

  it('resizes and resets a size', () => {
    const p = setBlockSize(planner(), PRIORITIES, 'height', { mm: 40 });
    const size = () => findBlock(p.template.pageTemplates['day-left']!, 'priorities')?.block.size;
    expect(size()?.height).toEqual({ mm: 40 });
    const back = setBlockSize(p, PRIORITIES, 'height', undefined);
    expect(findBlock(back.template.pageTemplates['day-left']!, 'priorities')?.block.size).toEqual(
      findBlock(planner().template.pageTemplates['day-left']!, 'priorities')?.block.size,
    );
  });
});

describe('pages and structure', () => {
  it('switches single pages and whole sections off', () => {
    let p = setPageEnabled(planner(), DAY, false);
    expect(findPage(p, DAY)!.enabled).toBe(false);
    const before = templateUsage(p)['day-left']!;
    p = setSectionEnabled(p, 'day:2026-10-06', false);
    expect(templateUsage(p)['day-left']).toBe(before - 1);
  });

  it('switches a recipe page off for every month and regenerates, keeping edits', () => {
    const month = planner().template.sections.findIndex((s) => s.repeat?.over === 'months');
    const children = planner().template.sections[month]!.children;
    const wheel = children.findIndex((c) => 'page' in c && c.page === 'wheel-of-life');
    let p = setBlockHiddenOnPage(planner(), DAY, 'halt', true);
    p = setRecipeChildEnabled(p, [month], wheel, false);
    expect(templateUsage(p)['wheel-of-life']).toBeUndefined();
    expect(findPage(p, DAY)!.overrides).toEqual({ halt: { hidden: true } });
    p = setRecipeChildEnabled(p, [month], wheel, true);
    expect(templateUsage(p)['wheel-of-life']).toBe(1);
  });

  it('reorders recipe entries', () => {
    const base = planner();
    const month = base.template.sections.findIndex((s) => s.repeat?.over === 'months');
    const children = base.template.sections[month]!.children;
    const wheel = children.findIndex((c) => 'page' in c && c.page === 'wheel-of-life');
    const p = moveRecipeChild(base, [month], wheel, wheel + 1);
    const order = (x: PlannerProject) =>
      pagesOf(x.document.root)
        .map((pg) => pg.templateId)
        .filter((id) => id === 'wheel-of-life' || id === 'monthly-review');
    expect(order(base)).toEqual(['wheel-of-life', 'monthly-review']);
    expect(order(p)).toEqual(['monthly-review', 'wheel-of-life']);
  });

  it('sets and clears variables', () => {
    const p = setVariable(planner(), 'patientName', 'Ala', true);
    expect(p.generation.variables.patientName).toEqual({ value: 'Ala', personal: true });
    expect(setVariable(p, 'patientName', ' ', true).generation.variables.patientName).toBe(
      undefined,
    );
  });
});

describe('history', () => {
  it('undoes and redoes, merging quick edits with the same key', () => {
    let h = emptyHistory<number>();
    h = record(h, 0, 'a', { now: 0 });
    h = record(h, 1, 'typing', { mergeKey: 'text', now: 100 });
    h = record(h, 2, 'typing', { mergeKey: 'text', now: 200 });
    h = record(h, 3, 'typing', { mergeKey: 'text', now: 5000 });
    expect(h.past.map((e) => e.value)).toEqual([0, 1, 3]);

    const u = undo(h, 4)!;
    expect(u.value).toBe(3);
    const r = redo(u.history, u.value)!;
    expect(r.value).toBe(4);
    expect(r.history.past).toHaveLength(3);
    expect(undo(emptyHistory<number>(), 0)).toBeUndefined();
    // A new edit clears the redo stack.
    expect(record(u.history, 3, 'b').future).toEqual([]);
  });

  it('keeps at most 200 steps', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < 250; i++) h = record(h, i, 'x');
    expect(h.past).toHaveLength(200);
    expect(h.past[0]!.value).toBe(50);
  });
});

describe('module variants', () => {
  const COMMITMENT = { templateId: 'day-left', blockId: 'commitment' };
  const TEMPLATE = { kind: 'template' } as const;
  const balance = (): PlannerProject => {
    const p = planner();
    return { ...p, generation: { ...p.generation, modules: { recovery: false } } };
  };
  const commitment = (p: PlannerProject) =>
    findBlock(p.template.pageTemplates['day-left']!, 'commitment')!.block;

  it('edits the wording that prints: the variant in use, not the hidden one', () => {
    const p = balance();
    expect(valueOrigin(p, COMMITMENT, 'props', 'title')).toBe('variant');
    const title = { en: 'My way today:', pl: 'Mój sposób na dziś:' };
    const edited = setBlockValue(p, COMMITMENT, 'props', 'title', title, TEMPLATE);
    const block = commitment(edited);
    expect((block.variants![0]!.props as Record<string, unknown>).title).toEqual(title);
    expect((block.props as Record<string, unknown>).title).toEqual(
      (commitment(p).props as Record<string, unknown>).title,
    );
  });

  it('edits the block itself in a planner with the module on', () => {
    const p = planner();
    expect(valueOrigin(p, COMMITMENT, 'props', 'title')).toBe('template');
    const title = { en: 'Today:', pl: 'Dziś:' };
    const block = commitment(setBlockValue(p, COMMITMENT, 'props', 'title', title, TEMPLATE));
    expect((block.props as Record<string, unknown>).title).toEqual(title);
  });

  it('edits a variant directly, even one that does not print in this planner', () => {
    const p = planner();
    const title = { en: 'I look after myself by:', pl: 'Dbam o siebie przez:' };
    const edited = setVariantValue(p, COMMITMENT, 0, 'title', title);
    const block = commitment(edited);
    expect((block.variants![0]!.props as Record<string, unknown>).title).toEqual(title);
    expect(block.props).toEqual(commitment(p).props);
    // Removing the value lets the variant use the block's own.
    const removed = commitment(setVariantValue(edited, COMMITMENT, 0, 'title', undefined));
    expect((removed.variants![0]!.props as Record<string, unknown>).title).toBeUndefined();
  });
});
