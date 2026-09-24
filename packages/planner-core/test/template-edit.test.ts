import type { BlockInstance, LayoutNode, PageTemplate } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import {
  findBlock,
  insertBlock,
  listBlocks,
  moveBlock,
  removeBlock,
  resolvePageTemplate,
  resolveTemplateForFormat,
  uniqueBlockId,
  updateBlock,
} from '../src';

const b = (id: string, props: Record<string, unknown> = {}): BlockInstance => ({
  id,
  type: 'text',
  props: props as BlockInstance['props'],
});
const leaf = (id: string, props?: Record<string, unknown>): LayoutNode => ({
  kind: 'block',
  block: b(id, props),
});

/** body: stack [title, row [left, right], notes]; rail: [goals] */
const page = (): PageTemplate => ({
  id: 'p',
  name: { en: 'P' },
  body: {
    kind: 'stack',
    gap: 4,
    children: [
      leaf('title'),
      { kind: 'row', gap: 5, children: [leaf('left', { count: 3 }), leaf('right')] },
      leaf('notes', { count: 8 }),
    ],
  },
  outerRail: [b('goals')],
  formatOverrides: {
    A5: [
      { op: 'add', path: '/body/children/1/children/0/block/props/count', value: 2 },
      { op: 'add', path: '/body/children/2/block/props/count', value: 5 },
      { op: 'add', path: '/body/children/1/height', value: { mm: 30 } },
    ],
  },
});

const a5Count = (t: PageTemplate, id: string) => {
  const block = findBlock(resolveTemplateForFormat(t, 'A5').template, id)?.block;
  return (block?.props as { count?: number } | undefined)?.count;
};

describe('block tree', () => {
  it('lists blocks in reading order with pointers', () => {
    expect(listBlocks(page()).map((e) => [e.block.id, e.pointer, e.container])).toEqual([
      ['title', '/body/children/0/block', 'stack'],
      ['left', '/body/children/1/children/0/block', 'row'],
      ['right', '/body/children/1/children/1/block', 'row'],
      ['notes', '/body/children/2/block', 'stack'],
      ['goals', '/outerRail/0', 'rail'],
    ]);
  });

  it('makes unique ids', () => {
    expect(uniqueBlockId(page(), 'quote')).toBe('quote');
    expect(uniqueBlockId(page(), 'notes')).toBe('notes-2');
    expect(uniqueBlockId(page(), 'notes-2')).toBe('notes-2');
  });
});

describe('structural edits keep A5 adjustments on their blocks', () => {
  it('moves a block and re-points its adjustment', () => {
    const moved = moveBlock(page(), 'notes', 0);
    expect(listBlocks(moved).map((e) => e.block.id)).toEqual([
      'notes',
      'title',
      'left',
      'right',
      'goals',
    ]);
    expect(a5Count(moved, 'notes')).toBe(5);
    expect(a5Count(moved, 'left')).toBe(2);
    expect(a5Count(moved, 'title')).toBeUndefined();
    // A non-block adjustment (the row's height) stays where it was.
    expect(moved.formatOverrides?.A5).toContainEqual({
      op: 'add',
      path: '/body/children/1/height',
      value: { mm: 30 },
    });
  });

  it('removes a block together with its adjustments', () => {
    const removed = removeBlock(page(), 'left');
    expect(findBlock(removed, 'left')).toBeUndefined();
    expect(removed.formatOverrides?.A5).toHaveLength(2);
    expect(a5Count(removed, 'notes')).toBe(5);
  });

  it('inserts after a block in the same container, or at the end of the body', () => {
    const inRow = insertBlock(page(), b('middle'), 'left');
    expect(
      listBlocks(inRow)
        .map((e) => e.block.id)
        .slice(1, 4),
    ).toEqual(['left', 'middle', 'right']);
    const inRail = insertBlock(page(), b('habit'), 'goals');
    expect(inRail.outerRail?.map((x) => x.id)).toEqual(['goals', 'habit']);
    const atEnd = insertBlock(page(), b('extra'));
    expect(listBlocks(atEnd).map((e) => e.block.id)[4]).toBe('extra');
    const top = insertBlock(page(), b('first'), 'title');
    expect(a5Count(top, 'notes')).toBe(5);
  });

  it('updates one block without touching the others', () => {
    const t = updateBlock(page(), 'right', (x) => ({ ...x, locked: true }));
    expect(findBlock(t, 'right')?.block.locked).toBe(true);
    expect(findBlock(t, 'left')?.block).toEqual(findBlock(page(), 'left')?.block);
  });
});

describe('resolvePageTemplate', () => {
  it('applies format, side variants, page overrides and visibility in order', () => {
    const t = updateBlock(page(), 'title', (x) => ({
      ...x,
      style: { fontSizePt: 12, align: 'start' },
      sideVariants: { left: { align: 'end' } },
    }));
    const withRule = updateBlock(t, 'right', (x) => ({
      ...x,
      visibility: { '==': [{ var: 'page.side' }, 'right'] },
    }));
    const { template, hidden } = resolvePageTemplate(withRule, {
      format: 'A5',
      side: 'left',
      overrides: {
        title: { style: { fontSizePt: 14 } },
        notes: { props: { count: 1 } },
        goals: { hidden: true },
      },
      scope: { page: { side: 'left' } },
    });
    expect(findBlock(template, 'title')?.block.style).toEqual({ fontSizePt: 14, align: 'end' });
    expect(findBlock(template, 'title')?.block.sideVariants).toBeUndefined();
    // The page override beats the A5 adjustment.
    expect(findBlock(template, 'notes')?.block.props).toEqual({ count: 1 });
    expect(findBlock(template, 'left')?.block.props).toEqual({ count: 2 });
    expect(hidden.sort()).toEqual(['goals', 'right']);
  });
});
