import type { PageTemplate } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import { applyPatch, resolveTemplateForFormat } from '../src';

describe('applyPatch', () => {
  const doc = { a: { b: [1, 2, 3] }, 'x/y': 1, 't~': 2 };

  it('replaces, adds and removes by JSON pointer without mutating', () => {
    const { value, warnings } = applyPatch(doc, [
      { op: 'replace', path: '/a/b/1', value: 20 },
      { op: 'add', path: '/a/b/-', value: 4 },
      { op: 'add', path: '/a/b/0', value: 0 },
      { op: 'remove', path: '/a/b/3' },
      { op: 'add', path: '/a/c', value: 'new' },
      { op: 'replace', path: '/x~1y', value: 10 },
      { op: 'remove', path: '/t~0' },
    ]);
    expect(warnings).toEqual([]);
    expect(value).toEqual({ a: { b: [0, 1, 20, 4], c: 'new' }, 'x/y': 10 });
    expect(doc.a.b).toEqual([1, 2, 3]);
  });

  it('skips and reports operations that do not fit', () => {
    const { value, warnings } = applyPatch(doc, [
      { op: 'replace', path: '/a/missing', value: 1 },
      { op: 'replace', path: '/a/b/9', value: 1 },
      { op: 'replace', path: 'no-slash', value: 1 },
      { op: 'replace', path: '/a/b/0/deeper', value: 1 },
      { op: 'replace', path: '/a/b/0', value: 5 },
    ]);
    expect(warnings).toHaveLength(4);
    expect(value.a.b).toEqual([5, 2, 3]);
  });
});

describe('resolveTemplateForFormat', () => {
  const template: PageTemplate = {
    id: 'daily',
    name: {},
    body: {
      kind: 'stack',
      gap: 4,
      children: [
        { kind: 'block', block: { id: 'schedule', type: 'time-grid', props: { linesPerSlot: 2 } } },
      ],
    },
    formatOverrides: {
      A5: [{ op: 'replace', path: '/body/children/0/block/props/linesPerSlot', value: 1 }],
    },
  };

  it('applies the A5 adjustments only for A5', () => {
    expect(resolveTemplateForFormat(template, 'A4').template).toBe(template);
    const a5 = resolveTemplateForFormat(template, 'A5').template;
    expect(a5.body).toEqual({
      kind: 'stack',
      gap: 4,
      children: [
        { kind: 'block', block: { id: 'schedule', type: 'time-grid', props: { linesPerSlot: 1 } } },
      ],
    });
  });
});
