import { z } from 'zod';
import { BlockInstance } from './block';
import { FormatId } from './formats';
import { LayoutNode } from './layout';
import { Id, LocalizedText, Mm, Side } from './primitives';

export const PatternSpec = z.object({
  kind: z.enum(['blank', 'lines', 'dots', 'squares']),
  /** Grid pitch in mm; the therapeutic template uses 5 mm. */
  pitch: Mm.optional(),
  /** Ink value 0–1 (1 = full black). Subtlety comes from value, not transparency (§8.2). */
  ink: z.number().finite().min(0).max(1).optional(),
});
export type PatternSpec = z.infer<typeof PatternSpec>;

/** RFC 6902-style operations applied to a page template for one format. */
export const JsonPatchOp = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.string().max(500),
  value: z.json().optional(),
});
export type JsonPatchOp = z.infer<typeof JsonPatchOp>;

export const PageTemplate = z.object({
  id: Id,
  name: LocalizedText,
  spread: z.object({ group: Id, position: Side }).optional(),
  background: PatternSpec.optional(),
  body: LayoutNode,
  /** Blocks pinned to the side-aware outer margin rail. */
  outerRail: z.array(BlockInstance).optional(),
  /** Opt-in absolute layer. */
  free: z.array(BlockInstance).optional(),
  formatOverrides: z.partialRecord(FormatId, z.array(JsonPatchOp)).optional(),
  /** Designer guidance ("why this layout"); never printed. */
  rationale: LocalizedText.optional(),
  /** Preview-only handwriting sample, keyed by block id; never exported. */
  sampleContent: z.record(z.string(), z.json()).optional(),
});
export type PageTemplate = z.infer<typeof PageTemplate>;
