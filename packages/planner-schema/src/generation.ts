import { z } from 'zod';
import { FormatId } from './formats';
import { Id, IsoDate, Locale } from './primitives';

/** A variable value supplied at generation time. `personal` values are stripped from template export. */
export const VariableValue = z.object({
  value: z.union([z.string().max(500), z.number().finite(), z.boolean()]),
  personal: z.boolean().optional(),
});
export type VariableValue = z.infer<typeof VariableValue>;

export const GenerationConfig = z.object({
  templateId: Id,
  format: FormatId,
  locale: Locale,
  /** Absent means an undated planner (§12). */
  startDate: IsoDate.optional(),
  durationMonths: z.number().int().min(1).max(12),
  monthMode: z.enum(['calendar', 'rolling']),
  weekOwnership: z.enum(['monday', 'iso-thursday']),
  dailyLayout: z.enum(['spread', 'one-per-page', 'two-per-page']),
  weeklyLayout: z.enum(['spread', 'single']),
  quoteCadence: z.enum(['daily', 'weekly', 'none']),
  volumes: z.union([z.literal(1), z.literal(2), z.literal(6)]),
  variables: z.record(z.string().max(100), VariableValue),
  /**
   * Modules switched on or off (ADR-0010), by module id. A module not listed takes the
   * template's default, so planners made before modules existed are unchanged.
   */
  modules: z.record(z.string().max(100), z.boolean()).optional(),
});
export type GenerationConfig = z.infer<typeof GenerationConfig>;
