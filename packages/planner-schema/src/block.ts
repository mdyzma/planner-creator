import { z } from 'zod';
import { Condition } from './condition';
import { Id, Length, Mm, Side } from './primitives';

/** Presentation only. Colours and fonts are theme-token names, not raw values (§4.3). */
export const BlockStyle = z.object({
  fontToken: z.string().max(100).optional(),
  fontSizePt: z.number().finite().min(4).max(96).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  lineHeight: z.number().finite().min(0.8).max(3).optional(),
  letterSpacingEm: z.number().finite().min(-0.2).max(1).optional(),
  align: z.enum(['start', 'center', 'end', 'justify']).optional(),
  colorToken: z.string().max(100).optional(),
  padding: Mm.optional(),
  borderWidthPt: z.number().finite().min(0).max(10).optional(),
  borderToken: z.string().max(100).optional(),
  radius: Mm.optional(),
});
export type BlockStyle = z.infer<typeof BlockStyle>;

export const BlockFrame = z.object({ x: Mm, y: Mm, w: Mm, h: Mm });
export type BlockFrame = z.infer<typeof BlockFrame>;

/** A block slice rendered on each page of a spread, over the block's column axis (§5.4). */
export const SpreadSplit = z.object({
  left: z.tuple([z.number().int().min(0), z.number().int().min(1)]),
  right: z.tuple([z.number().int().min(0), z.number().int().min(1)]),
});

/** Props (merged over the block's) and style used while `when` holds. */
export const BlockVariant = z.object({
  when: Condition,
  props: z.json().optional(),
  style: BlockStyle.optional(),
});
export type BlockVariant = z.infer<typeof BlockVariant>;

export const BlockInstance = z.object({
  id: Id,
  /** Key in the block registry. Core code never switches on this value. */
  type: z.string().min(1).max(100),
  /** Content and configuration; validated by the registered block definition's own schema. */
  props: z.json(),
  style: BlockStyle.optional(),
  sideVariants: z.partialRecord(Side, BlockStyle).optional(),
  size: z.object({ width: Length.optional(), height: Length.optional() }).optional(),
  /** Only for blocks on the free (absolute) layer. */
  frame: BlockFrame.optional(),
  spreadSplit: SpreadSplit.optional(),
  visibility: Condition.optional(),
  /**
   * Alternative props or style when a condition holds, e.g. neutral wording when the recovery
   * module is off (ADR-0010). The first matching variant applies, over the block's own props.
   */
  variants: z.array(BlockVariant).max(10).optional(),
  locked: z.boolean().optional(),
  keepTogether: z.boolean().optional(),
});
export type BlockInstance = z.infer<typeof BlockInstance>;

/** Sparse per-instance override of a template block (ADR-0003). */
export const BlockPatch = z.object({
  props: z.json().optional(),
  style: BlockStyle.optional(),
  hidden: z.boolean().optional(),
});
export type BlockPatch = z.infer<typeof BlockPatch>;
