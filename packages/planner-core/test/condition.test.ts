import type { Condition } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src';

const scope = {
  config: { dailyLayout: 'spread', durationMonths: 6, weekly: null },
  page: { dayOfWeek: 6 },
};

describe('evaluateCondition', () => {
  it('reads dotted variables and compares them', () => {
    expect(evaluateCondition({ '==': [{ var: 'config.dailyLayout' }, 'spread'] }, scope)).toBe(
      true,
    );
    expect(evaluateCondition({ '!=': [{ var: 'config.durationMonths' }, 6] }, scope)).toBe(false);
    expect(evaluateCondition({ in: [{ var: 'page.dayOfWeek' }, [5, 6]] }, scope)).toBe(true);
  });

  it('combines rules with and / or / not', () => {
    const weekend: Condition = { in: [{ var: 'page.dayOfWeek' }, [5, 6]] };
    expect(evaluateCondition({ and: [weekend, { var: 'config.dailyLayout' }] }, scope)).toBe(true);
    expect(evaluateCondition({ or: [{ not: weekend }, { var: 'config.weekly' }] }, scope)).toBe(
      false,
    );
  });

  it('treats missing or null paths as null, never throwing', () => {
    expect(evaluateCondition({ var: 'config.nope.deeper' }, scope)).toBe(false);
    expect(evaluateCondition({ '==': [{ var: 'missing' }, null] }, scope)).toBe(true);
    expect(evaluateCondition({ var: 'config' }, scope)).toBe(true);
  });
});
