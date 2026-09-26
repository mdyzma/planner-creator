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

/**
 * numbered-list: entries per item, entries under the sub-lines, ticked items (0-based).
 * `subFor` names the sub-line each `sub` column belongs to (its English label), so the entries stay
 * under the right line when a format prints fewer sub-lines; without it they go by position.
 */
export const ListSample = z.object({
  items: z.array(SampleText).optional(),
  sub: z.array(z.array(SampleText)).optional(),
  subFor: z.array(z.string()).optional(),
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

/** table: values per row, in column order. */
export const TableSample = z.array(z.array(SampleText));

/** text, day-header: values written into the printed blanks ("__________"), in order. */
export const BlanksSample = z.array(SampleText);

/** Width of a writing blank per underscore: "__________" (the default blank) is 18 mm. */
const BLANK_MM_PER_CHAR = 1.8;

/**
 * Printed text whose writing blanks ("___" or longer; "Mood _____ /10" is a short one for a
 * number) are filled with handwriting in example mode, in order, on a line as long as the blank.
 * Without examples the text prints as it is.
 */
export function withBlanks(
  ctx: BlockRenderContext,
  text: string,
  values: readonly SampleText[] | undefined,
  size = 4.6,
): ReactNode {
  if (!values?.length || !/_{3,}/.test(text)) return text;
  let blank = 0;
  // Splitting on a captured group keeps the blanks at the odd indexes.
  return text.split(/(_{3,})/).map((part, i) =>
    i % 2 === 0 ? (
      <span key={i}>{part}</span>
    ) : (
      <span
        key={i}
        style={{
          display: 'inline-block',
          minWidth: mm(part.length * BLANK_MM_PER_CHAR),
          borderBottom: '0.1mm solid currentColor',
          textAlign: 'center',
        }}
      >
        <Hand size={size}>{handText(ctx, values?.[blank++]) || ' '}</Hand>
      </span>
    ),
  );
}
