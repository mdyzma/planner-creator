import { createProject } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import {
  HANDWRITING_BLANK,
  addDays,
  addMonths,
  daysBetween,
  fillVariables,
  pageVariables,
  plannerEndDate,
} from '../src';

const base = createProject({
  id: 'p',
  name: 'P',
  format: 'A4',
  locale: 'pl',
  now: '2026-01-01T00:00:00.000Z',
});

describe('fillVariables', () => {
  it('fills known variables and leaves a writing line for the rest', () => {
    expect(
      fillVariables('Dzień {{ sobrietyDayNumber }} · {{dayName}}', { sobrietyDayNumber: '42' }),
    ).toBe(`Dzień 42 · ${HANDWRITING_BLANK}`);
    expect(fillVariables('{{empty}}', { empty: '  ' })).toBe(HANDWRITING_BLANK);
    expect(fillVariables('No tokens {x}', {})).toBe('No tokens {x}');
  });
});

describe('date arithmetic', () => {
  it('adds months with end-of-month clamping and counts days', () => {
    expect(addMonths('2026-10-01', 6)).toBe('2027-04-01');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-09-01', '2026-10-01')).toBe(30);
  });

  it('ends a 6-month planner the day before the same date six months later', () => {
    const project = { ...base, generation: { ...base.generation, startDate: '2026-10-01' } };
    expect(plannerEndDate(project)).toBe('2027-03-31');
    expect(plannerEndDate(base)).toBeUndefined();
  });
});

describe('pageVariables', () => {
  const project = {
    ...base,
    generation: {
      ...base.generation,
      startDate: '2026-10-01',
      variables: { sobrietyStartDate: { value: '2026-09-01' }, therapistName: { value: 'A. K.' } },
    },
  };

  it('derives day, month, week and sobriety day from the page date', () => {
    const vars = pageVariables(project, { date: '2026-10-05' }, 'pl');
    expect(vars).toMatchObject({
      dayName: 'Poniedziałek',
      monthName: 'Październik 2026',
      weekNumber: '41',
      sobrietyDayNumber: '35',
      therapistName: 'A. K.',
      plannerEndDate: 'Środa, 31 marca 2027',
    });
  });

  it('gives week pages a date range', () => {
    const week = [
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ];
    expect(pageVariables(project, { dates: week }, 'pl').weekRange).toBe(
      '5 października – 11 października',
    );
    expect(pageVariables(project, { dates: week }, 'en').weekRange).toBe('October 5 – October 11');
  });

  it('prints no sobriety day before the sobriety start or without one', () => {
    expect(pageVariables(project, { date: '2026-08-01' }, 'pl').sobrietyDayNumber).toBeUndefined();
    expect(pageVariables(base, { date: '2026-10-05' }, 'pl').sobrietyDayNumber).toBeUndefined();
  });
});
