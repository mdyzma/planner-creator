import type { BlockRenderContext } from '@planner/renderer';
import { emptyRenderContext } from '@planner/renderer';
import type { BlockInstance, ContentItem } from '@planner/schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_BLOCKS,
  BUILT_IN_PRESETS,
  HALT_B_ROWS,
  HALT_ROWS,
  createDefaultRegistry,
  haltVariables,
} from '../src';

const registry = createDefaultRegistry();
const ctx = (overrides: Partial<BlockRenderContext> = {}): BlockRenderContext => ({
  ...emptyRenderContext('pl', 'print'),
  ...overrides,
});
const render = (type: string, props: unknown, c: BlockRenderContext = ctx(), id = 'b1') =>
  renderToStaticMarkup(<>{registry.render({ id, type, props } as BlockInstance, c)}</>);
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('registry', () => {
  it.each(BUILT_IN_BLOCKS.map((b) => b.type))('%s renders with its defaults', (type) => {
    const html = render(type, {}, ctx({ mode: 'preview' }));
    expect(html).toContain(`data-block-type="${type}"`);
    expect(html).not.toContain('role="note"');
  });

  it.each(BUILT_IN_PRESETS.map((p) => [p.id, p] as const))('preset %s is valid', (_, preset) => {
    expect(render(preset.type, preset.props, ctx({ mode: 'preview' }))).not.toContain(
      'role="note"',
    );
  });

  it('flags unknown types and invalid props on screen, and prints nothing for them', () => {
    expect(render('nope', {}, ctx({ mode: 'preview' }))).toContain('Unknown block type');
    expect(render('numbered-list', { count: 99 }, ctx({ mode: 'preview' }))).toContain('count');
    expect(render('nope', {})).toBe('');
    expect(render('numbered-list', { count: 99 })).toBe('');
  });

  it('rejects duplicate block types', async () => {
    const { createBlockRegistry } = await import('../src');
    expect(() => createBlockRegistry([BUILT_IN_BLOCKS[0]!, BUILT_IN_BLOCKS[0]!])).toThrow();
  });
});

describe('text and quote', () => {
  it('fills variables, leaving a writing line when unset', () => {
    const t = { en: 'Day {{sobrietyDayNumber}}', pl: 'Dzień {{sobrietyDayNumber}}' };
    expect(text(render('text', { text: t }, ctx({ vars: { sobrietyDayNumber: '12' } })))).toBe(
      'Dzień 12',
    );
    expect(text(render('text', { text: t }))).toBe('Dzień __________');
  });

  it('prints the assigned quote with Polish quotation marks, or writing lines', () => {
    const quote: ContentItem = {
      id: 'q1',
      kind: 'quote',
      text: { en: 'One day.', pl: 'Jeden dzień.' },
      author: 'A',
      license: 'original',
      categories: [],
      tags: [],
    };
    const withQuote = render(
      'quote',
      {},
      ctx({ contentFor: (id) => (id === 'q' ? quote : undefined) }),
      'q',
    );
    expect(text(withQuote)).toBe('„Jeden dzień.” — A');
    expect(render('quote', { fallbackLines: 2 })).not.toContain('blockquote');
  });
});

describe('HALT and schedule', () => {
  it('prints letter badges and numbered circles for a 1–5 scale', () => {
    const html = render('rating-matrix', { rows: HALT_ROWS, mode: 'scale-1-5' });
    for (const badge of ['H', 'A', 'L', 'T']) expect(html).toContain(`>${badge}</span>`);
    expect(text(html)).toContain('Głód fizyczny');
    expect(html.match(/border-radius:50%/g)).toHaveLength(4 * 5);
  });

  it('switches HALT to tick boxes or a 0–10 scale', () => {
    expect(
      render('rating-matrix', { rows: HALT_ROWS, mode: 'checkbox' }).match(/border-radius:50%/g),
    ).toBeNull();
    expect(
      render('rating-matrix', { rows: HALT_ROWS, mode: 'scale-0-10' }).match(/border-radius:50%/g),
    ).toHaveLength(44);
  });

  it('lists every hour from 07:00 to 18:00 inclusive', () => {
    const html = render('time-grid', { from: 7, to: 18, linesPerSlot: 2 });
    const times = [...html.matchAll(/(\d{2}:\d{2})/g)].map((m) => m[1]);
    expect(times).toEqual([
      '07:00',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
    ]);
  });

  it('lists half-hour slots, also when the designer stores the interval as text', () => {
    const html = render('time-grid', { from: 20, to: 22, stepMinutes: '30' });
    const times = [...html.matchAll(/(\d{2}:\d{2})/g)].map((m) => m[1]);
    expect(times).toEqual(['20:00', '20:30', '21:00', '21:30', '22:00']);
  });
});

describe('calendar blocks', () => {
  const october = ctx({
    page: { date: '2026-10-01' },
    range: { start: '2026-10-01', end: '2027-03-31' },
  });

  it('lays out October 2026 Monday-first in five weeks', () => {
    const html = render('calendar-grid', { otherMonthDays: 'none' }, october);
    expect(html).toContain('grid-template-rows:repeat(5, 1fr)');
    const days = [...html.matchAll(/>(\d{1,2})<\/span>/g)].map((m) => Number(m[1]));
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    expect(text(html).startsWith('Pon. Wt. Śr. Czw. Pt. Sob. Niedz.')).toBe(true);
  });

  it('splits the month across a spread: Mon–Thu on the left, Fri–Sun on the right', () => {
    const none = { otherMonthDays: 'none' };
    const left = render('calendar-grid', { columns: [0, 4], ...none }, october);
    const right = render('calendar-grid', { columns: [4, 7], ...none }, october);
    expect(left).toContain('grid-template-columns:repeat(4, 1fr)');
    expect(right).toContain('grid-template-columns:repeat(3, 1fr)');
    const days = (html: string) =>
      [...html.matchAll(/>(\d{1,2})<\/span>/g)].map((m) => Number(m[1]));
    expect(days(left)[0]).toBe(1); // Thursday 1 October is in the left half
    expect(days(right)[0]).toBe(2); // Friday 2 October starts the right half
    expect([...days(left), ...days(right)].sort((a, b) => a - b)).toHaveLength(31);
  });

  it('greys the days of the neighbouring months by default, or only the previous month', () => {
    const greyed = (html: string) =>
      [...html.matchAll(/data-other-month="true"[^>]*><span[^>]*>(\d{1,2})<\/span>/g)].map((m) =>
        Number(m[1]),
      );
    // October 2026 starts on a Thursday: 28–30 September lead in; November fills the last week.
    expect(greyed(render('calendar-grid', {}, october))).toEqual([28, 29, 30, 1]);
    expect(greyed(render('calendar-grid', { otherMonthDays: 'previous' }, october))).toEqual([
      28, 29, 30,
    ]);
    expect(render('calendar-grid', { otherMonthDays: 'none' }, october)).not.toContain(
      'data-other-month',
    );
  });

  it('accepts the week count as chosen in the designer', () => {
    expect(render('calendar-grid', { rows: '6' }, october)).toContain(
      'grid-template-rows:repeat(6, 1fr)',
    );
  });

  it('uses six weeks when a month needs them', () => {
    // August 2027 starts on a Sunday: 6 + 31 days span six Monday-first weeks.
    expect(render('calendar-grid', {}, ctx({ page: { date: '2027-08-01' } }))).toContain(
      'grid-template-rows:repeat(6, 1fr)',
    );
  });

  it('shows the date of a weekly day strip and fades days outside the planner', () => {
    const week = [
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ];
    const before = render(
      'day-strip',
      { weekday: 0 },
      ctx({ page: { dates: week }, range: { start: '2026-10-01', end: '2027-03-31' } }),
    );
    const inside = render(
      'day-strip',
      { weekday: 3 },
      ctx({ page: { dates: week }, range: { start: '2026-10-01', end: '2027-03-31' } }),
    );
    expect(text(before)).toContain('Poniedziałek 28 września');
    expect(before).toContain('opacity:0.45');
    expect(text(inside)).toContain('Czwartek 1 października');
    expect(inside).toContain('opacity:1');
  });

  it('prints the daily date header and a blank line for an undated planner', () => {
    expect(text(render('day-header', {}, ctx({ page: { date: '2026-10-05' } })))).toContain(
      'Poniedziałek 5 października',
    );
    expect(text(render('day-header', {}))).toContain('Dzień trzeźwości numer: __________');
  });
});

describe('therapeutic blocks', () => {
  it('draws the Wheel of Life with ten rings and eight labelled areas', () => {
    const html = render('radial-scale', {});
    expect(html.match(/<circle/g)).toHaveLength(10);
    expect(text(html)).toContain('Trzeźwość i 12 Kroków');
  });

  it('prints category boxes with editable headings and examples', () => {
    const html = render('category-grid', {
      cells: [
        { title: { en: 'Body', pl: 'Ciało' }, examples: [{ en: 'insomnia', pl: 'bezsenność' }] },
      ],
    });
    expect(text(html)).toContain('Ciało np. bezsenność');
  });

  it('prints printed list items and gender-resolved text', () => {
    const html = render(
      'numbered-list',
      { items: [{ pl: 'Jestem {g:gotowy|gotowa}' }], count: 1 },
      ctx({ gender: 'feminine' }),
    );
    expect(text(html)).toBe('1. Jestem gotowa');
  });
});

describe('example handwriting (guide and example exports)', () => {
  const withSample = (sample: unknown) =>
    ctx({ sample: (id) => (id === 'b1' ? (sample as never) : undefined) });

  it('writes nothing unless example mode provides a sample', () => {
    const plain = render('writing-area', { title: { pl: 'Refleksje' } });
    expect(plain).not.toContain('planner-hand');
    expect(plain).not.toContain('data-sample-note');
  });

  it('writes example lines and a note in handwriting', () => {
    const html = render(
      'writing-area',
      { title: { pl: 'Refleksje' } },
      withSample({
        fill: { pl: 'Mityng pomógł.\nJutro spacer.', en: 'The meeting helped.' },
        note: { pl: 'wolne miejsce', en: 'free space' },
      }),
    );
    expect(text(html)).toContain('Mityng pomógł. Jutro spacer.');
    expect(text(html)).toContain('→ wolne miejsce');
    expect(html).toContain('--planner-hand');
  });

  it('prints the rows and name of the chosen HALT variant', () => {
    const title = { pl: 'Skala {{haltName}}' };
    const b = text(render('rating-matrix', { variant: 'halt-b', title }));
    expect(b).toContain('Skala HALT-B');
    expect(b).toContain('Nuda / brak celu');
    const classic = text(render('rating-matrix', { variant: 'halt', title, rows: HALT_B_ROWS }));
    expect(classic).toContain('Skala HALT ');
    expect(classic).not.toContain('Nuda');
    expect(text(render('rating-matrix', { rows: HALT_ROWS }))).toContain('Zmęczenie');
  });

  it('names the HALT variant of a planner for its instructions', () => {
    const page = (variant: string) => ({
      body: {
        kind: 'block' as const,
        block: { id: 'h', type: 'rating-matrix', props: { variant } },
      },
    });
    expect(haltVariables({ a: page('halt') }, 'pl')).toEqual({
      haltName: 'HALT',
      haltFeelings: '{g:głodny|głodna}, {g:zły|zła}, {g:samotny|samotna} lub {g:zmęczony|zmęczona}',
    });
    expect(haltVariables({ a: page('halt-b') }, 'en').haltFeelings).toBe(
      'hungry, angry, lonely, tired or bored',
    );
    expect(haltVariables({ a: page('custom') }, 'en')).toEqual({});
  });

  it('rings the chosen HALT values and fills list items', () => {
    const halt = render(
      'rating-matrix',
      { rows: HALT_ROWS, mode: 'scale-1-5' },
      withSample({ fill: { values: [2, null, 5, 1] } }),
    );
    expect((halt.match(/<path d="M10 1.5 C15.5/g) ?? []).length).toBe(3);
    const list = render(
      'numbered-list',
      { count: 3, marker: 'checkbox' },
      withSample({ fill: { items: ['mityng', { pl: 'spacer' }], done: [0] } }),
    );
    expect(text(list)).toContain('✓ mityng');
    expect(text(list)).toContain('spacer');
  });

  it('keeps sub-line entries under their own line when a format prints fewer sub-lines', () => {
    const fill = {
      items: ['mityng'],
      sub: [['wyjść 17:15', 'poprosić Tomka']],
      subFor: ['How:', 'If it gets hard:'],
    };
    const hard = { en: 'If it gets hard:', pl: 'Gdy będzie trudno:' };
    const html = render('numbered-list', { count: 1, subLines: [hard] }, withSample({ fill }));
    expect(text(html)).toContain('Gdy będzie trudno: poprosić Tomka');
    expect(text(html)).not.toContain('wyjść 17:15');
  });

  it('fills the printed blanks of a text', () => {
    const html = render(
      'day-header',
      {},
      ctx({ page: { date: '2026-10-01' }, sample: () => ({ fill: ['42'] }) }),
    );
    expect(text(html)).toContain('Dzień trzeźwości numer: 42');
  });

  it('ignores samples of the wrong shape', () => {
    expect(render('time-grid', {}, withSample({ fill: 42 }))).not.toContain('planner-hand');
  });
});
