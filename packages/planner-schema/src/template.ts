import { z } from 'zod';
import { Condition } from './condition';
import { PageNumbering } from './numbering';
import { FormatId } from './formats';
import { GenerationConfig } from './generation';
import { PageTemplate } from './page-template';
import { Id, Locale, LocalizedText, Side } from './primitives';
import { PrintSettings } from './print';

export const RepeatSpec = z.discriminatedUnion('over', [
  z.object({ over: z.literal('months') }),
  z.object({ over: z.literal('weeksOfMonth') }),
  z.object({ over: z.literal('daysOfWeek'), group: z.number().int().min(1).max(7).optional() }),
  z.object({ over: z.literal('count'), n: z.number().int().min(1).max(1000) }),
  z.object({ over: z.literal('list'), items: z.array(z.string()) }),
]);
export type RepeatSpec = z.infer<typeof RepeatSpec>;

export const StartOn = z.union([Side, z.literal('any')]);

export interface PageRef {
  page: string;
  startOn?: 'left' | 'right' | 'any';
  /** `false` leaves the page out of generated planners (the designer's structure switch). */
  enabled?: boolean;
}

export interface SectionTemplate {
  id: string;
  title: LocalizedText;
  repeat?: RepeatSpec;
  startOn?: 'left' | 'right' | 'any';
  /** Start on a recto and end on a verso so the section can be printed on its own sheets. */
  sheetAligned?: boolean;
  optional?: boolean;
  /** `false` leaves the section out of generated planners (the designer's structure switch). */
  enabled?: boolean;
  numbering?: PageNumbering;
  when?: Condition;
  children: Array<SectionTemplate | PageRef>;
}

const PageRefSchema = z.object({
  page: Id,
  startOn: StartOn.optional(),
  enabled: z.boolean().optional(),
});

export const SectionTemplate: z.ZodType<SectionTemplate> = z.lazy(() =>
  z.object({
    id: Id,
    title: LocalizedText,
    repeat: RepeatSpec.optional(),
    startOn: StartOn.optional(),
    sheetAligned: z.boolean().optional(),
    optional: z.boolean().optional(),
    enabled: z.boolean().optional(),
    numbering: PageNumbering.optional(),
    when: Condition.optional(),
    children: z.array(z.union([PageRefSchema, SectionTemplate])),
  }),
);

export const VariableDefinition = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/)
    .max(100),
  label: LocalizedText,
  type: z.enum(['text', 'date', 'number']),
  personal: z.boolean(),
});
export type VariableDefinition = z.infer<typeof VariableDefinition>;

export const ThemeTokens = z.record(z.string().max(100), z.string().max(200));

export const PlannerTemplate = z.object({
  schemaVersion: z.number().int().min(1),
  id: Id,
  version: z.string().max(50),
  name: LocalizedText,
  description: LocalizedText,
  supportedFormats: z.array(FormatId).min(1),
  supportedLocales: z.array(Locale).min(1),
  defaults: z.object({
    print: PrintSettings,
    theme: ThemeTokens,
    generation: GenerationConfig.partial(),
  }),
  pageTemplates: z.record(Id, PageTemplate),
  sections: z.array(SectionTemplate),
  variables: z.array(VariableDefinition),
  contentLibraryRefs: z.array(Id),
});
export type PlannerTemplate = z.infer<typeof PlannerTemplate>;
