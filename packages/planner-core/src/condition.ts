import type { Condition, ConditionOperand, ConditionValue } from '@planner/schema';

/**
 * Evaluates a visibility / inclusion rule (§4.7) over a plain data scope. The rule language is a
 * small JSON-Logic subset and is interpreted, never executed, so imported templates cannot run
 * code. `{ var: "config.dailyLayout" }` reads a dotted path; a missing path is `null`.
 */
export function evaluateCondition(
  condition: Condition,
  scope: Readonly<Record<string, unknown>>,
): boolean {
  return Boolean(evaluate(condition, scope));
}

function lookup(path: string, scope: Readonly<Record<string, unknown>>): ConditionValue {
  let value: unknown = scope;
  for (const part of path.split('.')) {
    if (typeof value !== 'object' || value === null || !(part in value)) return null;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : value === null || value === undefined
      ? null
      : true; // objects and arrays count as present
}

function operand(o: ConditionOperand, scope: Readonly<Record<string, unknown>>): ConditionValue {
  return typeof o === 'object' && o !== null ? lookup(o.var, scope) : o;
}

function evaluate(c: Condition, scope: Readonly<Record<string, unknown>>): ConditionValue {
  if ('var' in c) return lookup(c.var, scope);
  if ('==' in c) return operand(c['=='][0], scope) === operand(c['=='][1], scope);
  if ('!=' in c) return operand(c['!='][0], scope) !== operand(c['!='][1], scope);
  if ('in' in c) return c.in[1].includes(operand(c.in[0], scope));
  if ('and' in c) return c.and.every((x) => Boolean(evaluate(x, scope)));
  if ('or' in c) return c.or.some((x) => Boolean(evaluate(x, scope)));
  return !evaluate(c.not, scope);
}
