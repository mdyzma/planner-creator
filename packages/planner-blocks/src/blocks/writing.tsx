import { mm, resolveText } from '@planner/renderer';
import { LocalizedText } from '@planner/schema';
import { z } from 'zod';
import { BlockTitle, RULE, TYPE, WriteLine, WritingSurface, column, fill } from '../primitives';
import { defineBlock } from '../registry';

const L = (en: string, pl: string) => ({ en, pl });

const WritingAreaProps = z.object({
  title: LocalizedText.optional(),
  hint: LocalizedText.optional(),
  pattern: z.enum(['lines', 'dots', 'squares', 'blank']),
  /** Line or grid spacing in mm; 0 means the pattern's default (7 mm lines, 5 mm grids). */
  pitch: z.number().min(0).max(15),
  ink: z.number().min(0.1).max(1),
  framed: z.boolean(),
});

/** Space to write by hand: reflections, answers to prompts, notes (§14, §21). */
export const writingAreaBlock = defineBlock({
  type: 'writing-area',
  version: 1,
  label: L('Writing area', 'Pole do pisania'),
  category: 'writing',
  propsSchema: WritingAreaProps,
  defaults: { pattern: 'lines', pitch: 0, ink: 0.5, framed: false },
  inspector: [
    { key: 'title', kind: 'localized-text', label: L('Title or question', 'Tytuł lub pytanie') },
    { key: 'hint', kind: 'localized-text', label: L('Hint', 'Podpowiedź') },
    {
      key: 'pattern',
      kind: 'select',
      label: L('Surface', 'Powierzchnia'),
      options: [
        { value: 'lines', label: L('Lines', 'Linie') },
        { value: 'dots', label: L('Dot grid', 'Kropki') },
        { value: 'squares', label: L('Squares', 'Kratka') },
        { value: 'blank', label: L('Blank', 'Gładka') },
      ],
    },
    {
      key: 'pitch',
      kind: 'number',
      label: L('Spacing (mm)', 'Odstęp (mm)'),
      min: 0,
      max: 15,
      step: 0.5,
    },
    {
      key: 'ink',
      kind: 'number',
      label: L('Line darkness', 'Intensywność linii'),
      min: 0.1,
      max: 1,
      step: 0.05,
    },
  ],
  Render: ({ props, ctx }) => {
    const pitch = props.pitch || (props.pattern === 'lines' ? 7 : 5);
    return (
      <div
        style={{
          ...column,
          ...(props.framed ? { border: RULE, borderRadius: mm(1.5), padding: mm(2.5) } : {}),
          boxSizing: 'border-box',
        }}
      >
        <BlockTitle>{resolveText(ctx, props.title)}</BlockTitle>
        {props.hint && (
          <div style={{ ...TYPE.caption, marginBottom: mm(1), flex: 'none' }}>
            {resolveText(ctx, props.hint)}
          </div>
        )}
        <WritingSurface pattern={{ kind: props.pattern, pitch, ink: props.ink }} />
      </div>
    );
  },
});

const ListProps = z.object({
  title: LocalizedText.optional(),
  count: z.number().int().min(1).max(12),
  marker: z.enum(['number', 'checkbox', 'bullet', 'none']),
  /** Printed items (SOS steps, safety rules); empty items become writing lines. */
  items: z.array(LocalizedText),
  /** Labelled sub-lines under each item, e.g. plan and safeguard for daily priorities. */
  subLines: z.array(LocalizedText),
  lineHeight: z.number().min(4).max(14),
});

/** Numbered goals, priorities, gratitude lines, printed steps (§11, §20). */
export const numberedListBlock = defineBlock({
  type: 'numbered-list',
  version: 1,
  label: L('List', 'Lista'),
  category: 'writing',
  propsSchema: ListProps,
  defaults: { count: 3, marker: 'number', items: [], subLines: [], lineHeight: 7 },
  inspector: [
    { key: 'title', kind: 'localized-text', label: L('Title', 'Tytuł') },
    {
      key: 'count',
      kind: 'number',
      label: L('Number of items', 'Liczba pozycji'),
      min: 1,
      max: 12,
    },
    {
      key: 'marker',
      kind: 'select',
      label: L('Marker', 'Znacznik'),
      options: [
        { value: 'number', label: L('Numbers', 'Numery') },
        { value: 'checkbox', label: L('Tick boxes', 'Pola wyboru') },
        { value: 'bullet', label: L('Bullets', 'Punkty') },
        { value: 'none', label: L('None', 'Brak') },
      ],
    },
    { key: 'items', kind: 'localized-list', label: L('Printed items', 'Wydrukowane pozycje') },
    { key: 'subLines', kind: 'localized-list', label: L('Sub-lines', 'Linie pomocnicze') },
  ],
  Render: ({ props, ctx }) => {
    const count = Math.max(props.count, props.items.length);
    const marker = (i: number) => {
      const box = { width: mm(5), flex: 'none', ...TYPE.subheading } as const;
      if (props.marker === 'number') return <span style={box}>{i + 1}.</span>;
      if (props.marker === 'bullet') return <span style={box}>•</span>;
      if (props.marker === 'checkbox') {
        return (
          <span style={{ ...box, display: 'flex', alignItems: 'flex-end', paddingBottom: mm(0.8) }}>
            <span
              style={{
                width: mm(3.2),
                height: mm(3.2),
                border: RULE,
                borderRadius: mm(0.5),
                display: 'inline-block',
              }}
            />
          </span>
        );
      }
      return null;
    };
    return (
      <div style={column}>
        <BlockTitle>{resolveText(ctx, props.title)}</BlockTitle>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, ...column, gap: mm(1) }}>
          {Array.from({ length: count }, (_, i) => {
            const printed = props.items[i] ? resolveText(ctx, props.items[i]) : '';
            return (
              <li
                key={i}
                style={{
                  ...fill,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: mm(props.lineHeight),
                }}
              >
                {printed ? (
                  <div
                    style={{ display: 'flex', alignItems: 'baseline', gap: mm(1), ...TYPE.body }}
                  >
                    {marker(i)}
                    <span>{printed}</span>
                  </div>
                ) : (
                  <WriteLine height={props.lineHeight} style={{ flex: 1 }}>
                    {marker(i)}
                  </WriteLine>
                )}
                {props.subLines.map((label, s) => (
                  <WriteLine
                    key={s}
                    height={props.lineHeight * 0.8}
                    light
                    style={{ flex: 1, marginLeft: mm(6) }}
                  >
                    <span style={TYPE.caption}>{resolveText(ctx, label)}</span>
                  </WriteLine>
                ))}
              </li>
            );
          })}
        </ol>
      </div>
    );
  },
});
