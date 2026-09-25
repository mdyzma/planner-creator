import { generate } from '@planner/generator';
import type { PlannerProject } from '@planner/schema';
import { createProject, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { describe, expect, it } from 'vitest';
import { planExport } from '../src';

const template = parseTemplate(templateJson);
const quotes = parseContentLibrary(quotesJson);
if (!template.ok || !quotes.ok) throw new Error('fixtures invalid');

function planner(format: 'A4' | 'A5'): PlannerProject {
  const p = createProject({
    id: 'p',
    name: 'Test',
    format,
    locale: 'pl',
    now: '2026-09-24T00:00:00.000Z',
    template: template.ok ? template.value : (undefined as never),
  });
  const generation = { ...p.generation, startDate: '2026-10-01', durationMonths: 6 };
  const content = [quotes.ok ? quotes.value : (undefined as never)];
  const { document } = generate({
    template: p.template,
    config: generation,
    content,
    seed: 'p',
    profile: p.print.profile,
  });
  return { ...p, content, generation, document };
}

describe('planExport', () => {
  it('renders the whole planner as one part per section, covering every page once', () => {
    const plan = planExport(planner('A4'), { profile: 'home-duplex' });
    expect(plan.parts.map((p) => p.key)).toEqual([
      'root/intro',
      'month:2026-10',
      'month:2026-11',
      'month:2026-12',
      'month:2027-01',
      'month:2027-02',
      'month:2027-03',
      'root/crisis',
    ]);
    plan.parts.forEach((p, i) => {
      if (i > 0) expect(p.from).toBe(plan.parts[i - 1]!.to + 1);
    });
    expect(plan.parts.at(-1)!.to + 1).toBe(plan.pageCount);
    expect(plan.pageCount % 2).toBe(0);
    // Every section fills whole sheets, so each month can be printed and filed on its own.
    expect(plan.sections.every((s) => s.wholeSheets)).toBe(true);
  });

  it('pads a single month to whole A4 sheets for 2-up printing', () => {
    const project = planner('A5');
    const plan = planExport(project, { profile: 'home-a5-2up', sections: ['month:2026-11'] });
    expect(plan.parts).toHaveLength(1);
    expect(plan.pageCount % 4).toBe(0);
    const part = plan.parts[0]!;
    expect(part.to - part.from + 1 + part.padAfter).toBe(plan.pageCount);
    expect(() => planExport(project, { profile: 'home-duplex', sections: ['nope'] })).toThrow();
  });

  it('prints any choice of sections in planner order, e.g. months without intro and crisis', () => {
    const project = planner('A4');
    const all = planExport(project, { profile: 'home-duplex' });
    const plan = planExport(project, {
      profile: 'home-duplex',
      sections: ['month:2026-12', 'month:2026-10'],
    });
    expect(plan.parts.map((p) => p.key)).toEqual(['month:2026-10', 'month:2026-12']);
    const months = all.sections.filter((s) => s.key.startsWith('month:'));
    const expected = months
      .filter((s) => s.key === 'month:2026-10' || s.key === 'month:2026-12')
      .reduce((n, s) => n + s.to - s.from + 1, 0);
    expect(plan.pageCount).toBe(expected);
    expect(plan.pageCount % 2).toBe(0);
  });
});
