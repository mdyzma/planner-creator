import { z } from 'zod';

export const FORMAT_IDS = ['A4', 'A5'] as const;
export const FormatId = z.enum(FORMAT_IDS);
export type FormatId = z.infer<typeof FormatId>;

export interface PageFormat {
  id: FormatId;
  /** Trim width in mm (portrait). */
  width: number;
  /** Trim height in mm (portrait). */
  height: number;
}

/** ISO 216 portrait trim sizes. */
export const PAGE_FORMATS: Readonly<Record<FormatId, PageFormat>> = {
  A4: { id: 'A4', width: 210, height: 297 },
  A5: { id: 'A5', width: 148, height: 210 },
};

export const MM_PER_PT = 25.4 / 72;
export const mmToPt = (mm: number): number => mm / MM_PER_PT;
export const ptToMm = (pt: number): number => pt * MM_PER_PT;
