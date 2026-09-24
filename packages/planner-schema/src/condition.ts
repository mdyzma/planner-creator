import { z } from 'zod';

/**
 * Declarative visibility rule: a JSON-Logic subset evaluated over `{ page, config, vars }`.
 * Pure data, never executed as code, so imported templates cannot run scripts (§4.7).
 */
export type ConditionValue = string | number | boolean | null;

export type Condition =
  | { var: string }
  | { '==': [ConditionOperand, ConditionOperand] }
  | { '!=': [ConditionOperand, ConditionOperand] }
  | { in: [ConditionOperand, ConditionValue[]] }
  | { and: Condition[] }
  | { or: Condition[] }
  | { not: Condition };

export type ConditionOperand = ConditionValue | { var: string };

const ConditionValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const VarRef = z.object({ var: z.string().min(1).max(200) });
const Operand = z.union([ConditionValueSchema, VarRef]);

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    VarRef,
    z.object({ '==': z.tuple([Operand, Operand]) }),
    z.object({ '!=': z.tuple([Operand, Operand]) }),
    z.object({ in: z.tuple([Operand, z.array(ConditionValueSchema)]) }),
    z.object({ and: z.array(Condition).min(1) }),
    z.object({ or: z.array(Condition).min(1) }),
    z.object({ not: Condition }),
  ]),
);
