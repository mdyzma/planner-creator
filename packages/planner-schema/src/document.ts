import { z } from 'zod';
import { BlockPatch } from './block';
import { Id, IsoDate, LocalizedText } from './primitives';

/** Where a generated page sits in time and structure; drives variables like {{dayName}}. */
export const PageContext = z.object({
  date: IsoDate.optional(),
  dates: z.array(IsoDate).optional(),
  monthIndex: z.number().int().min(0).optional(),
  weekIndex: z.number().int().min(0).optional(),
  dayIndex: z.number().int().min(0).optional(),
  volume: z.number().int().min(1).optional(),
});
export type PageContext = z.infer<typeof PageContext>;

export const PageInstance = z.object({
  /** Stable semantic key, e.g. `m2/w3/d/2026-11-18/L`; used to re-attach edits on regeneration. */
  key: z.string().min(1).max(300),
  templateId: Id,
  context: PageContext,
  enabled: z.boolean(),
  origin: z.enum(['generated', 'manual', 'filler']),
  overrides: z.record(Id, BlockPatch).optional(),
  contentAssignments: z.record(Id, Id).optional(),
});
export type PageInstance = z.infer<typeof PageInstance>;

export interface SectionNode {
  key: string;
  title: LocalizedText;
  enabled: boolean;
  children: Array<SectionNode | PageInstance>;
}

export const SectionNode: z.ZodType<SectionNode> = z.lazy(() =>
  z.object({
    key: z.string().min(1).max(300),
    title: LocalizedText,
    enabled: z.boolean(),
    children: z.array(z.union([PageInstance, SectionNode])),
  }),
);

export const PlannerDocument = z.object({ root: SectionNode });
export type PlannerDocument = z.infer<typeof PlannerDocument>;

export const isPageInstance = (node: SectionNode | PageInstance): node is PageInstance =>
  'templateId' in node;

/** Counts page instances in the document (logical pages, before pagination adds fillers). */
export function countPageInstances(node: SectionNode): number {
  return node.children.reduce(
    (sum, child) => sum + (isPageInstance(child) ? 1 : countPageInstances(child)),
    0,
  );
}
