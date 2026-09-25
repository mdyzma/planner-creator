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
  /** Counted but not printed, e.g. the cover (page i of the front matter). */
  hidePageNumber: z.boolean().optional(),
  /** Blocks pinned to the side-aware outer margin rail. */
  outerRail: z.array(BlockInstance).optional(),
  /** Rail width for this page; overrides the print setting (e.g. ~28 mm on weekly pages). */
  outerRailWidth: Mm.optional(),
  /** Opt-in absolute layer. */
  free: z.array(BlockInstance).optional(),
  formatOverrides: z.partialRecord(FormatId, z.array(JsonPatchOp)).optional(),
  /** Designer guidance ("why this layout"); never printed. */
  rationale: LocalizedText.optional(),
  /** What to write on this page and why, for the printed guide; never printed on the page. */
  guide: LocalizedText.optional(),
  /**
   * Example filling, keyed by block id: `{ fill, note }`, where `fill` is block-specific example
   * handwriting and `note` a short handwritten explanation. Printed only in example mode.
   */
  sampleContent: z.record(z.string(), z.json()).optional(),
});
export type PageTemplate = z.infer<typeof PageTemplate>;
