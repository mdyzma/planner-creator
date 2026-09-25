import { HANDWRITING_BLANK } from '@planner/i18n';
import type { BlockRenderContext } from '@planner/renderer';
import { mm } from '@planner/renderer';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { Hand, handText } from './primitives';

/**
 * Shapes of example fills per block type (PageTemplate.sampleContent[blockId].fill). Text is
 * either one string for both languages (names, numbers) or `{ en, pl }`.
 */
export const SampleText = z.union([
  z.string(),
  z.object({ en: z.string().optional(), pl: z.string().optional() }),
]);
export type SampleText = z.infer<typeof SampleText>;

/** writing-area, category cells: lines separated by "\n". */
export const WritingSample = SampleText;

/** numbered-list: entries per item, entries under the sub-lines, ticked items (0-based). */
export const ListSample = z.object({
  items: z.array(SampleText).optional(),
  sub: z.array(z.array(SampleText)).optional(),
  done: z.array(z.number().int()).optional(),
});

/** rating-matrix: circled value per row (null = none), ticks, and notes per row. */
export const RatingSample = z.object({
  values: z.array(z.number().int().nullable()).optional(),
  ticks: z.array(z.boolean()).optional(),
  notes: z.array(SampleText).optional(),
});

/** time-grid: entries by time, e.g. { "09:00": "Therapy" }. */
export const TimeSample = z.record(z.string(), SampleText);

/** calendar-grid: entries by day of the month, e.g. { "14": "Doctor 10:00" }. */
export const CalendarSample = z.record(z.string(), SampleText);

/** day-strip: circled event markers and a few lines of notes. */
export const DayStripSample = z.object({
  markers: z.array(z.string()).optional(),
  text: SampleText.optional(),
});

/** radial-scale: a score per area, shaded from the centre. */
export const WheelSample = z.array(z.number().min(0).max(10));

/** category-grid: lines per box. */
export const CategorySample = z.array(SampleText);

/** contact-table: values per person, in field order. */
export const ContactSample = z.array(z.array(SampleText));

/** text, day-header: values written into the printed blanks ("__________"), in order. */
export const BlanksSample = z.array(SampleText);

/**
 * Printed text whose writing blanks are filled with handwriting: "Sobriety day: __________"
 * becomes "Sobriety day: 42" with the number handwritten on the line.
 */
export function withBlanks(
  ctx: BlockRenderContext,
  text: string,
  values: readonly SampleText[] | undefined,
  size = 4.6,
): ReactNode {
  if (!values?.length || !text.includes(HANDWRITING_BLANK)) return text;
  const parts = text.split(HANDWRITING_BLANK);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && (
        <span
          style={{
            display: 'inline-block',
            minWidth: mm(18),
            borderBottom: '0.1mm solid currentColor',
            textAlign: 'center',
          }}
        >
          <Hand size={size}>{handText(ctx, values[i]) || ' '}</Hand>
        </span>
      )}
    </span>
  ));
}
