import { resolveText, typographyCss } from '@planner/renderer';
import { LocalizedText } from '@planner/schema';
import { z } from 'zod';
import { TYPE, quoteMarks, BlockTitle, WriteLine, column, sampleFill } from '../primitives';
import { defineBlock } from '../registry';
import { BlanksSample, withBlanks } from '../samples';

const L = (en: string, pl: string) => ({ en, pl });

const TextProps = z.object({
  text: LocalizedText,
  variant: z.enum(['heading', 'subheading', 'body', 'caption', 'label']),
  align: z.enum(['start', 'center', 'end']),
});

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
  Render: ({ props, block, ctx }) => (
    <div
      style={{
        ...TYPE[props.variant],
        textAlign: props.align,
        whiteSpace: 'pre-line',
        ...typographyCss(block.style),
      }}
    >
      {withBlanks(ctx, resolveText(ctx, props.text), sampleFill(ctx, block.id, BlanksSample))}
    </div>
  ),
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
