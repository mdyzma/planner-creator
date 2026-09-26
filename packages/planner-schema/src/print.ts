import { z } from 'zod';
import { Mm } from './primitives';

/** Logical margins; `inner`/`outer` resolve to left/right from the page side (§5.1). */
export const Margins = z.object({
  inner: Mm,
  outer: Mm,
  top: Mm,
  bottom: Mm,
});
export type Margins = z.infer<typeof Margins>;

export const Binding = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ring'),
    preset: z.enum(['iso838-2hole', 'iso838-4hole', 'a5-6ring', 'custom']),
    holeCentreFromEdge: Mm,
    holeDiameter: Mm,
    /** Hole centres in mm along the binding edge, measured from the top. */
    holePositions: z.array(Mm),
    punchGuides: z.boolean(),
  }),
  z.object({ kind: z.literal('sewn') }),
  z.object({ kind: z.literal('none') }),
]);
export type Binding = z.infer<typeof Binding>;
export type RingBinding = Extract<Binding, { kind: 'ring' }>;

export const PrintProfile = z.enum([
  'home-duplex',
  'home-manual-duplex',
  'home-a5-2up',
  'home-a5-native',
  'home-booklet',
  'print-shop',
]);
export type PrintProfile = z.infer<typeof PrintProfile>;

export const PrintSettings = z.object({
  profile: PrintProfile,
  margins: Margins,
  /** Minimum distance from trim that a home printer can reach. */
  printerSafeMargin: Mm,
  /** Width of the outer rail used by pinned blocks; 0 disables it. */
  outerRail: Mm,
  bleed: Mm,
  cropMarks: z.boolean(),
  binding: Binding,
  pageNumbers: z.boolean(),
  /** The YAPCO apple beside the page number; on when not set. */
  brandMark: z.boolean().optional(),
  color: z.enum(['color', 'grayscale']),
  calibrationPage: z.boolean(),
});
export type PrintSettings = z.infer<typeof PrintSettings>;
