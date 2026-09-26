import { mm, resolveText, typographyCss } from '@planner/renderer';
import { LocalizedText } from '@planner/schema';
import { z } from 'zod';
import {
  TYPE,
  quoteMarks,
  BlockTitle,
  Hand,
  WriteLine,
  column,
  handText,
  sampleFill,
} from '../primitives';
import { defineBlock } from '../registry';
import { BlanksSample, withBlanks } from '../samples';

const L = (en: string, pl: string) => ({ en, pl });

const TextProps = z.object({
  text: LocalizedText,
  variant: z.enum(['heading', 'subheading', 'body', 'caption', 'label']),
  /**
   * `spread` lays each line out as fields separated by " · ", spaced evenly across the full
   * width (e.g. a line of check-in numbers); each field stays together. `columns` splits each
   * line at its first blank into label, blank and the rest, and lines them up as a table across
   * the full width: labels on the left, units on the right, and the blank as a line between.
   */
  align: z.enum(['start', 'center', 'end', 'spread', 'columns']),
});

const SEPARATOR = ' · ';
const blankCount = (text: string) => text.match(/_{3,}/g)?.length ?? 0;

/** Printed text: headings, instructions, captions. Supports {{variables}} and gendered wording. */
export const textBlock = defineBlock({
  type: 'text',
  version: 1,
  label: L('Text', 'Tekst'),
  category: 'text',
  propsSchema: TextProps,
  defaults: { text: {}, variant: 'body', align: 'start' },
  inspector: [
    { key: 'text', kind: 'localized-text', label: L('Text', 'Tekst'), multiline: true },
    {
      key: 'variant',
      kind: 'select',
      label: L('Style', 'Styl'),
      options: [
        { value: 'heading', label: L('Heading', 'Nagłówek') },
        { value: 'subheading', label: L('Subheading', 'Śródtytuł') },
        { value: 'body', label: L('Body', 'Treść') },
        { value: 'caption', label: L('Caption', 'Podpis') },
        { value: 'label', label: L('Label', 'Etykieta') },
      ],
    },
  ],
  Render: ({ props, block, ctx }) => {
    const text = resolveText(ctx, props.text);
    const values = sampleFill(ctx, block.id, BlanksSample);
    if (props.align === 'columns') {
      // The blank takes whatever width is left, so the lines line up however long the labels are;
      // example values fill the blanks in order.
      let used = 0;
      const blank = (key: string) => (
        <span
          key={key}
          style={{ borderBottom: '0.1mm solid currentColor', textAlign: 'center', minWidth: 0 }}
        >
          <Hand size={4.6}>{handText(ctx, values?.[used++]) || ' '}</Hand>
        </span>
      );
      return (
        <div
          style={{
            ...TYPE[props.variant],
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'baseline',
            columnGap: mm(1),
            ...typographyCss(block.style),
          }}
        >
          {text.split('\n').flatMap((line, l) => {
            const found = /_{3,}/.exec(line);
            if (!found)
              return [
                <span key={l} style={{ gridColumn: '1 / -1' }}>
                  {line}
                </span>,
              ];
            return [
              <span key={`${l}a`}>{line.slice(0, found.index).trim()}</span>,
              blank(`${l}b`),
              <span key={`${l}c`}>{line.slice(found.index + found[0].length).trim()}</span>,
            ];
          })}
        </div>
      );
    }
    if (props.align === 'spread') {
      // Example values fill the blanks in order across all fields and lines.
      let used = 0;
      const field = (part: string, key: string) => {
        const node = <span key={key}>{withBlanks(ctx, part, values?.slice(used))}</span>;
        used += blankCount(part);
        return node;
      };
      // Every line gets as many slots as the longest, so fields line up in columns; the extra
      // slots of a shorter line stay empty.
      const lines = text.split('\n').map((line) => line.split(SEPARATOR));
      const slots = Math.max(...lines.map((parts) => parts.length));
      return (
        <div style={{ ...TYPE[props.variant], ...typographyCss(block.style) }}>
          {lines.map((parts, l) => (
            <div
              key={l}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
            >
              {Array.from({ length: slots }, (_, f) => {
                const part = parts[f] ?? '';
                return [
                  ...(f > 0 ? [<span key={`s${f}`}>{part ? '·' : ''}</span>] : []),
                  field(part, `f${f}`),
                ];
              })}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div
        style={{
          ...TYPE[props.variant],
          textAlign: props.align,
          whiteSpace: 'pre-line',
          ...typographyCss(block.style),
        }}
      >
        {withBlanks(ctx, text, values)}
      </div>
    );
  },
});

const QuoteProps = z.object({
  /** Handwriting lines printed when no quote is assigned to this page. */
  fallbackLines: z.number().int().min(0).max(4),
  showAuthor: z.boolean(),
  title: LocalizedText.optional(),
});

/** The day's supportive quote from the content library (assigned per page by the generator). */
export const quoteBlock = defineBlock({
  type: 'quote',
  version: 1,
  label: L('Quote', 'Sentencja'),
  category: 'text',
  propsSchema: QuoteProps,
  defaults: { fallbackLines: 2, showAuthor: true },
  inspector: [
    {
      key: 'fallbackLines',
      kind: 'number',
      label: L('Lines when empty', 'Linie, gdy brak sentencji'),
      min: 0,
      max: 4,
    },
    { key: 'showAuthor', kind: 'boolean', label: L('Show author', 'Pokaż autora') },
  ],
  Render: ({ props, block, ctx }) => {
    const item = ctx.contentFor(block.id);
    const [open, close] = quoteMarks(ctx.locale);
    if (!item) {
      return (
        <div style={column}>
          <BlockTitle>{resolveText(ctx, props.title)}</BlockTitle>
          {Array.from({ length: props.fallbackLines }, (_, i) => (
            <WriteLine key={i} height={6} light />
          ))}
        </div>
      );
    }
    return (
      <figure style={{ margin: 0, ...column, justifyContent: 'center' }}>
        <blockquote
          style={{ margin: 0, ...TYPE.body, fontStyle: 'italic', ...typographyCss(block.style) }}
        >
          {open}
          {resolveText(ctx, item.text)}
          {close}
        </blockquote>
        {props.showAuthor && item.author && (
          <figcaption style={{ ...TYPE.caption, marginTop: '1mm' }}>— {item.author}</figcaption>
        )}
      </figure>
    );
  },
});
