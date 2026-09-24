import { z } from 'zod';
import { BlockInstance } from './block';
import { Length, LocalizedText, Mm } from './primitives';

/** Flow layout tree rendered with CSS grid/flex in mm (ADR-0002). */
export type LayoutNode =
  | {
      kind: 'stack';
      gap: number;
      children: LayoutNode[];
      height?: Length;
      label?: LocalizedText;
    }
  | { kind: 'row'; gap: number; children: LayoutNode[]; height?: Length }
  | { kind: 'block'; block: BlockInstance };

export const LayoutNode: z.ZodType<LayoutNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('stack'),
      gap: Mm,
      children: z.array(LayoutNode),
      height: Length.optional(),
      label: LocalizedText.optional(),
    }),
    z.object({
      kind: z.literal('row'),
      gap: Mm,
      children: z.array(LayoutNode),
      height: Length.optional(),
    }),
    z.object({ kind: z.literal('block'), block: BlockInstance }),
  ]),
);
