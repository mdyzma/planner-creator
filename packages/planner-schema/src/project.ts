import { z } from 'zod';
import { ContentLibrary } from './content';
import { PlannerDocument } from './document';
import { FormatId } from './formats';
import { GenerationConfig } from './generation';
import { Id, IsoDateTime, Locale } from './primitives';
import { PrintSettings } from './print';
import { PlannerTemplate } from './template';

export const ExportRecord = z.object({
  at: IsoDateTime,
  kind: z.enum(['pdf', 'json']),
  pageCount: z.number().int().min(0).optional(),
});

export const PlannerProject = z.object({
  schemaVersion: z.number().int().min(1),
  id: Id,
  meta: z.object({
    name: z.string().min(1).max(200),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
    lastExport: ExportRecord.optional(),
  }),
  /** Provenance only; the project owns a forked copy of its template (ADR-0003). */
  templateSource: z.object({ id: Id, version: z.string().max(50) }),
  template: PlannerTemplate,
  content: z.array(ContentLibrary),
  generation: GenerationConfig,
  print: PrintSettings,
  locale: Locale,
  format: FormatId,
  i18nOptions: z.object({
    grammaticalGender: z.enum(['slash', 'feminine', 'masculine', 'neutral']),
  }),
  document: PlannerDocument,
});
export type PlannerProject = z.infer<typeof PlannerProject>;
