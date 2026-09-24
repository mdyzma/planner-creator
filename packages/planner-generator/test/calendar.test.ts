import { addDays } from '@planner/i18n';
import type { GenerationConfig } from '@planner/schema';
import { defaultGenerationConfig } from '@planner/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { endDateOf, planMonths } from '../src';

const config = (overrides: Partial<GenerationConfig>): GenerationConfig => ({
  ...defaultGenerationConfig('t', 'A4', 'pl'),
  ...overrides,
});

const allDays = (c: GenerationConfig) =>
  planMonths(c).flatMap((m) => m.weeks.flatMap((w) => w.days));

describe('planMonths: the brief example (2026-10-01, 6 months)', () => {
  const months = planMonths(config({ startDate: '2026-10-01' }));

  it('has one block per calendar month, October to March', () => {
    expect(months.map((m) => m.key)).toEqual([
      'month:2026-10',
      'month:2026-11',
      'month:2026-12',
      'month:2027-01',
      'month:2027-02',
      'month:2027-03',
    ]);
    expect(months[0]!.title).toEqual({ en: 'October 2026', pl: 'Październik 2026' });
  });

  it('gives weeks to the month of their Monday: 5, 5, 4, 4, 4, 5 (design §12)', () => {
    expect(months.map((m) => m.weeks.length)).toEqual([5, 5, 4, 4, 4, 5]);
    expect(months[0]!.weeks[0]!.key).toBe('week:2026-09-28'); // contains the start day
    expect(months[0]!.weeks[0]!.days).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(months[5]!.weeks.at(-1)!.days).toEqual(['2027-03-29', '2027-03-30', '2027-03-31']);
  });

  it('covers all 182 days exactly once', () => {
    const days = allDays(config({ startDate: '2026-10-01' }));
    expect(days).toHaveLength(182);
    expect(new Set(days).size).toBe(182);
    expect(endDateOf(config({ startDate: '2026-10-01' }))).toBe('2027-03-31');
  });
});

describe('planMonths: other starts and modes', () => {
  it('gives a mid-month start its own short first and last month (no merging)', () => {
    const months = planMonths(config({ startDate: '2026-10-30' }));
    expect(months.map((m) => m.key)).toEqual([
      'month:2026-10',
      'month:2026-11',
      'month:2026-12',
      'month:2027-01',
      'month:2027-02',
      'month:2027-03',
      'month:2027-04',
    ]);
    expect(months[0]!.start).toBe('2026-10-30');
    expect(months[0]!.weeks.map((w) => w.days)).toEqual([
      ['2026-10-30', '2026-10-31', '2026-11-01'],
    ]);
  });

  it('can use the ISO rule: weeks belong to the month of their Thursday', () => {
    const iso = planMonths(config({ startDate: '2026-10-01', weekOwnership: 'iso-thursday' }));
    // Week of Mon 2026-11-30: Thursday is 3 December, so it moves to December.
    expect(iso[1]!.weeks.map((w) => w.key)).not.toContain('week:2026-11-30');
    expect(iso[2]!.weeks[0]!.key).toBe('week:2026-11-30');
  });

  it('supports rolling months counted from the start day', () => {
    const rolling = planMonths(config({ startDate: '2026-10-15', monthMode: 'rolling' }));
    expect(rolling.map((m) => [m.key, m.start, m.end])).toEqual([
      ['month:r1', '2026-10-15', '2026-11-14'],
      ['month:r2', '2026-11-15', '2026-12-14'],
      ['month:r3', '2026-12-15', '2027-01-14'],
      ['month:r4', '2027-01-15', '2027-02-14'],
      ['month:r5', '2027-02-15', '2027-03-14'],
      ['month:r6', '2027-03-15', '2027-04-14'],
    ]);
  });

  it('plans undated planners as four undated weeks per month', () => {
    const undated = planMonths(config({ startDate: undefined, durationMonths: 3 }));
    expect(undated.map((m) => m.weeks.length)).toEqual([4, 4, 4]);
    expect(undated[0]!.weeks[0]!.dates).toBeUndefined();
  });
});

describe('planMonths: properties over any start date and length', () => {
  const date = fc
    .date({ min: new Date('2000-01-01'), max: new Date('2099-01-01'), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 10));
  const arb = fc.record({
    startDate: date,
    durationMonths: fc.integer({ min: 1, max: 12 }),
    weekOwnership: fc.constantFrom('monday' as const, 'iso-thursday' as const),
    monthMode: fc.constantFrom('calendar' as const, 'rolling' as const),
  });

  it('covers every planner day exactly once, in order, in Monday-first weeks', () => {
    fc.assert(
      fc.property(arb, (overrides) => {
        const c = config(overrides);
        const end = endDateOf(c)!;
        const expected: string[] = [];
        for (let d = c.startDate!; d <= end; d = addDays(d, 1)) expected.push(d);
        expect(allDays(c)).toEqual(expected);
        for (const m of planMonths(c)) {
          for (const w of m.weeks) {
            expect(new Date(`${w.dates![0]}T00:00:00Z`).getUTCDay()).toBe(1);
            expect(w.dates).toHaveLength(7);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
