import { paginate } from '@planner/core';
import type { PageInstance, PlannerProject, PlannerTemplate, SectionNode } from '@planner/schema';
import {
  createProject,
  isPageInstance,
  parseContentLibrary,
  parseProject,
  parseTemplate,
} from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { describe, expect, it } from 'vitest';
import { generate, regenerate, validateTemplate } from '../src';

const parsedTemplate = parseTemplate(templateJson);
const parsedQuotes = parseContentLibrary(quotesJson);
if (!parsedTemplate.ok || !parsedQuotes.ok) throw new Error('fixtures invalid');
const template = parsedTemplate.value;
const quotes = parsedQuotes.value;

const pagesOf = (node: SectionNode): PageInstance[] =>
  node.children.flatMap((c) => (isPageInstance(c) ? [c] : pagesOf(c)));

function project(
  startDate: string | undefined,
  overrides: Partial<PlannerProject['generation']> = {},
): PlannerProject {
  const p = createProject({
    id: 'demo',
    name: 'Demo',
    format: 'A4',
    locale: 'pl',
    now: '2026-09-24T00:00:00.000Z',
    template,
  });
  return { ...p, content: [quotes], generation: { ...p.generation, startDate, ...overrides } };
}

const run = (p: PlannerProject) =>
  generate({
    template: p.template,
    config: p.generation,
    content: p.content,
    seed: p.id,
    profile: p.print.profile,
  });

describe('generate: 6-month therapeutic planner from 2026-10-01', () => {
  const result = run(project('2026-10-01'));
  const pages = pagesOf(result.document.root);

  it('produces a valid document', () => {
    const p = { ...project('2026-10-01'), document: result.document };
    expect(parseProject(p).ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('has a daily spread for each of the 182 days and a weekly spread for each of the 27 weeks', () => {
    const count = (id: string) => pages.filter((p) => p.templateId === id).length;
    expect(count('day-left')).toBe(182);
    expect(count('day-right')).toBe(182);
    expect(count('week-left')).toBe(27);
    expect(count('month-divider')).toBe(6);
    expect(count('wheel-of-life')).toBe(6);
    expect(count('sos')).toBe(1);
  });

  it('keys pages by date, so they are stable across regeneration', () => {
    expect(
      pages.find((p) => p.context.date === '2026-10-06' && p.templateId === 'day-left')?.key,
    ).toBe('day:2026-10-06/day-left');
    expect(new Set(pages.map((p) => p.key)).size).toBe(pages.length);
    expect(
      pages.filter((p) => p.templateId === 'notes').map((p) => p.key.split('/').pop()),
    ).toContain('notes#2');
  });

  it('gives each page its date context: day, week dates, or first of month', () => {
    const week = pages.find((p) => p.templateId === 'week-left')!;
    expect(week.context.dates).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(pages.find((p) => p.templateId === 'month-open-left')!.context.date).toBe('2026-10-01');
    expect(pages.find((p) => p.templateId === 'day-left')!.context.date).toBe('2026-10-01');
  });

  it('counts about 530 printed pages, in whole duplex sheets, with spreads facing each other', () => {
    expect(result.budget.total).toBeGreaterThanOrEqual(515);
    expect(result.budget.total).toBeLessThanOrEqual(545);
    expect(result.budget.total % 2).toBe(0);
    expect(result.budget.sheets).toBe(result.budget.total / 2);
    const { pages: printed } = paginate(result.document.root, {
      templates: template.pageTemplates,
      padTo: 2,
    });
    for (const p of printed) {
      const spread = p.instance && template.pageTemplates[p.instance.templateId]?.spread;
      if (spread) expect(p.side).toBe(spread.position);
    }
  });

  it('deals a different quote each day, cycling the library before repeating', () => {
    expect(result.content.slots).toBe(182);
    expect(result.content.available).toBe(12);
    expect(result.content.maxUses).toBe(Math.ceil(182 / 12));
    expect(result.content.minGap).toBe(12);
    const firstWeek = pages
      .filter((p) => p.templateId === 'day-left')
      .slice(0, 7)
      .map((p) => p.contentAssignments?.quote);
    expect(new Set(firstWeek).size).toBe(7);
  });

  it('is deterministic for a seed and reshuffles for another', () => {
    const again = run(project('2026-10-01'));
    expect(again.document).toEqual(result.document);
    const other = generate({
      template,
      config: project('2026-10-01').generation,
      content: [quotes],
      seed: 'other',
    });
    expect(pagesOf(other.document.root).map((p) => p.contentAssignments?.quote)).not.toEqual(
      pages.map((p) => p.contentAssignments?.quote),
    );
  });
});

describe('generate: options', () => {
  it('uses one quote per week with weekly cadence, none with "none"', () => {
    const weekly = pagesOf(run(project('2026-10-05', { quoteCadence: 'weekly' })).document.root)
      .filter((p) => p.templateId === 'day-left')
      .slice(0, 7)
      .map((p) => p.contentAssignments?.quote);
    expect(new Set(weekly).size).toBe(1);
    const none = pagesOf(run(project('2026-10-05', { quoteCadence: 'none' })).document.root);
    expect(none.some((p) => p.contentAssignments)).toBe(false);
  });

  it('generates an undated planner with blank days', () => {
    const result = run(project(undefined, { durationMonths: 2 }));
    const pages = pagesOf(result.document.root);
    expect(pages.filter((p) => p.templateId === 'day-left')).toHaveLength(2 * 4 * 7);
    expect(pages.every((p) => p.context.date === undefined)).toBe(true);
  });

  it('skips sections whose "when" rule is false', () => {
    const conditional: PlannerTemplate = {
      ...template,
      sections: [
        ...template.sections,
        {
          id: 'extra',
          title: { en: 'Extra' },
          when: { '==': [{ var: 'config.dailyLayout' }, 'two-per-page'] },
          children: [{ page: 'notes' }],
        },
      ],
    };
    const keys = (layout: 'spread' | 'two-per-page') =>
      pagesOf(
        generate({
          template: conditional,
          config: { ...project('2026-10-01').generation, dailyLayout: layout },
          content: [],
          seed: 's',
        }).document.root,
      ).map((p) => p.key);
    expect(keys('spread')).not.toContain('root/extra/notes');
    expect(keys('two-per-page')).toContain('root/extra/notes');
  });

  it('leaves out switched-off sections and pages, keeping the other pages keys', () => {
    const extra: PlannerTemplate = {
      ...template,
      sections: [
        ...template.sections,
        {
          id: 'extra',
          title: { en: 'Extra' },
          children: [{ page: 'notes', enabled: false }, { page: 'notes' }],
        },
        { id: 'off', title: { en: 'Off' }, enabled: false, children: [{ page: 'notes' }] },
      ],
    };
    const keys = pagesOf(
      generate({
        template: extra,
        config: project('2026-10-01').generation,
        content: [],
        seed: 's',
      }).document.root,
    ).map((p) => p.key);
    expect(keys.filter((k) => k.startsWith('root/extra/'))).toEqual(['root/extra/notes#2']);
    expect(keys.some((k) => k.startsWith('root/off'))).toBe(false);
  });
});

describe('validateTemplate', () => {
  it('accepts the therapeutic template', () => {
    expect(validateTemplate(template)).toEqual([]);
  });

  it('reports missing pages, incomplete spreads, misplaced repeats and contradictions', () => {
    const { ['day-right']: _removed, ...pageTemplates } = template.pageTemplates;
    const broken: PlannerTemplate = {
      ...template,
      pageTemplates,
      sections: [
        { id: 'days', title: {}, repeat: { over: 'daysOfWeek' }, children: [{ page: 'day-left' }] },
        {
          id: 'outer',
          title: {},
          startOn: 'left',
          children: [{ id: 'inner', title: {}, sheetAligned: true, children: [{ page: 'nope' }] }],
        },
      ],
    };
    const codes = validateTemplate(broken)
      .map((i) => i.code)
      .sort();
    expect(codes).toEqual([
      'contradictory-alignment',
      'repeat-outside-parent',
      'spread-incomplete',
      'spread-order',
      'unknown-page',
    ]);
  });
});

describe('regenerate', () => {
  it('keeps edits on pages that still exist and reports the ones that no longer do', () => {
    const original = { ...project('2026-10-01') };
    const generated = { ...original, document: run(original).document };

    // The user edits two days and turns one off.
    const edit = (key: string, fn: (p: PageInstance) => PageInstance) => {
      const visit = (n: SectionNode): SectionNode => ({
        ...n,
        children: n.children.map((c) =>
          isPageInstance(c) ? (c.key === key ? fn(c) : c) : visit(c),
        ),
      });
      return visit;
    };
    const kept = 'day:2026-11-03/day-left';
    const dropped = 'day:2026-10-02/day-left';
    let root = edit(kept, (p) => ({ ...p, overrides: { commitment: { hidden: true } } }))(
      generated.document.root,
    );
    root = edit(dropped, (p) => ({ ...p, enabled: false }))(root);
    const edited = { ...generated, document: { root } };

    // Start a month later: October disappears, November stays.
    const moved = regenerate({
      ...edited,
      generation: { ...edited.generation, startDate: '2026-11-01' },
    });
    const pages = pagesOf(moved.document.root);
    expect(pages.find((p) => p.key === kept)?.overrides).toEqual({ commitment: { hidden: true } });
    expect(moved.orphans).toEqual([dropped]);
    expect(pages.filter((p) => p.templateId === 'day-left')).toHaveLength(181);
    expect(parseProject(moved.project).ok).toBe(true);
  });
});

describe('stability across start dates (regression)', () => {
  const quoteOn = (p: PlannerProject, date: string) =>
    pagesOf(run(p).document.root).find(
      (x) => x.templateId === 'day-left' && x.context.date === date,
    )?.contentAssignments?.quote;

  it('keeps the key and edits of a day whose week moves to another month', () => {
    // 1 Nov 2026 is a Sunday in the week of Mon 26 Oct: October's week when starting 1 Oct,
    // November's first week when starting 1 Nov. Its key must not change.
    const oct = run(project('2026-10-01'));
    const day = pagesOf(oct.document.root).find(
      (p) => p.context.date === '2026-11-01' && p.templateId === 'day-left',
    )!;
    expect(day.key).toBe('day:2026-11-01/day-left');

    const edited: PlannerProject = {
      ...project('2026-10-01'),
      document: {
        root: JSON.parse(
          JSON.stringify(oct.document.root).replace(
            '"key":"day:2026-11-01/day-left","templateId":"day-left"',
            '"key":"day:2026-11-01/day-left","templateId":"day-left","overrides":{"halt":{"hidden":true}}',
          ),
        ),
      },
    };
    const moved = regenerate({
      ...edited,
      generation: { ...edited.generation, startDate: '2026-11-01' },
    });
    const kept = pagesOf(moved.document.root).find((p) => p.key === 'day:2026-11-01/day-left');
    expect(kept?.overrides).toEqual({ halt: { hidden: true } });
  });

  it('gives a date the same quote whatever the start date', () => {
    expect(quoteOn(project('2026-10-01'), '2026-12-24')).toBe(
      quoteOn(project('2026-12-01'), '2026-12-24'),
    );
  });

  it('never repeats a quote within the deck size after regenerating to a new start', () => {
    const original = { ...project('2026-10-01') };
    const withDoc = { ...original, document: run(original).document };
    const moved = regenerate({
      ...withDoc,
      generation: { ...withDoc.generation, startDate: '2026-11-01' },
    });
    const sequence = pagesOf(moved.document.root)
      .filter((p) => p.templateId === 'day-left')
      .map((p) => p.contentAssignments?.quote);
    for (let i = 0; i < sequence.length; i++) {
      expect(sequence.slice(i + 1, i + 12)).not.toContain(sequence[i]);
    }
  });
});
