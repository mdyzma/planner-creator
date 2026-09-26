import { mm, resolveText } from '@planner/renderer';
import { LocalizedText } from '@planner/schema';
import { z } from 'zod';
import {
  BlockTitle,
  Hand,
  HandLines,
  RULE,
  TYPE,
  WriteLine,
  WritingSurface,
  column,
  fill,
  handText,
  sampleFill,
} from '../primitives';
import { ListSample, TableSample, WritingSample } from '../samples';
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
  Render: ({ props, block, ctx }) => {
    const pitch = props.pitch || (props.pattern === 'lines' ? 7 : 5);
    const sample = sampleFill(ctx, block.id, WritingSample);
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
        <WritingSurface pattern={{ kind: props.pattern, pitch, ink: props.ink }}>
          {sample !== undefined && (
            // On grids, one line of writing spans whole grid rows, at least 6 mm.
            <HandLines
              text={handText(ctx, sample)}
              pitch={props.pattern === 'lines' ? pitch : pitch * Math.ceil(6 / pitch)}
            />
          )}
        </WritingSurface>
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
  Render: ({ props, block, ctx }) => {
    const count = Math.max(props.count, props.items.length);
    const sample = sampleFill(ctx, block.id, ListSample);
    const handSize = Math.min(5.2, props.lineHeight * 0.7);
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
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
              }}
            >
              {sample?.done?.includes(i) && (
                <Hand size={4.6} style={{ overflow: 'visible', marginTop: mm(-1) }}>
                  ✓
                </Hand>
              )}
            </span>
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
                    <Hand size={handSize}>{handText(ctx, sample?.items?.[i])}</Hand>
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
                    <Hand size={handSize * 0.85}>
                      {handText(
                        ctx,
                        sample?.sub?.[i]?.[
                          sample.subFor ? sample.subFor.indexOf(label.en ?? '') : s
                        ],
                      )}
                    </Hand>
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

const TableProps = z.object({
  title: LocalizedText.optional(),
  /** Heading over the row labels, e.g. "Week". */
  rowHeader: LocalizedText.optional(),
  /** Printed row labels. */
  rows: z.array(LocalizedText).min(1).max(12),
  /** Column headings; with none, each row has one cell to write in and there is no heading row. */
  columns: z.array(LocalizedText).max(8),
  /** `grid` draws every cell; `lines` only a writing line under each cell. */
  ruling: z.enum(['grid', 'lines']),
});

/**
 * A table to fill in by hand: printed row labels and column headings, empty cells. With `lines`
 * and no columns it is a list of labelled lines ("For my health: ____").
 */
export const tableBlock = defineBlock({
  type: 'table',
  version: 1,
  label: L('Table', 'Tabela'),
  category: 'writing',
  propsSchema: TableProps,
  defaults: {
    rows: [L('1', '1'), L('2', '2'), L('3', '3')],
    columns: [],
    ruling: 'grid',
  },
  inspector: [
    { key: 'title', kind: 'localized-text', label: L('Title', 'Tytuł') },
    { key: 'rowHeader', kind: 'localized-text', label: L('Row heading', 'Nagłówek wierszy') },
    { key: 'rows', kind: 'localized-list', label: L('Rows', 'Wiersze') },
    { key: 'columns', kind: 'localized-list', label: L('Columns', 'Kolumny') },
    {
      key: 'ruling',
      kind: 'select',
      label: L('Lines', 'Linie'),
      options: [
        { value: 'grid', label: L('Grid', 'Siatka') },
        { value: 'lines', label: L('Writing lines', 'Linie do pisania') },
      ],
    },
  ],
  Render: ({ props, block, ctx }) => {
    const sample = sampleFill(ctx, block.id, TableSample);
    const cols = Math.max(1, props.columns.length);
    const heads = props.columns.length > 0;
    const grid = props.ruling === 'grid';
    const cell = {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: grid ? 'center' : 'flex-start',
      padding: `0 ${mm(1)} ${mm(0.6)}`,
      minWidth: 0,
      ...(grid
        ? { borderRight: RULE, borderBottom: RULE }
        : { borderBottom: RULE, marginLeft: mm(1) }),
    } as const;
    const label = {
      display: 'flex',
      alignItems: 'flex-end',
      padding: `0 ${mm(1.5)} ${mm(0.6)} ${grid ? mm(1) : 0}`,
      ...TYPE.body,
      ...(grid ? { borderRight: RULE, borderBottom: RULE } : {}),
    } as const;
    const head = {
      ...TYPE.caption,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      textAlign: 'center',
      padding: `${mm(0.8)} ${mm(1)}`,
      ...(grid ? { borderRight: RULE, borderBottom: RULE } : {}),
    } as const;
    return (
      <div style={column}>
        <BlockTitle>{resolveText(ctx, props.title)}</BlockTitle>
        <div
          style={{
            ...fill,
            display: 'grid',
            gridTemplateColumns: `max-content repeat(${cols}, 1fr)`,
            gridTemplateRows: `${heads ? 'auto ' : ''}repeat(${props.rows.length}, 1fr)`,
            ...(grid ? { borderTop: RULE, borderLeft: RULE } : {}),
          }}
        >
          {heads && (
            <>
              <span style={{ ...head, justifyContent: 'flex-start' }}>
                {resolveText(ctx, props.rowHeader)}
              </span>
              {props.columns.map((c, j) => (
                <span key={j} style={head}>
                  {resolveText(ctx, c)}
                </span>
              ))}
            </>
          )}
          {props.rows.flatMap((row, i) => [
            <span key={`l${i}`} style={label}>
              {resolveText(ctx, row)}
            </span>,
            ...Array.from({ length: cols }, (_, j) => (
              <span key={`c${i}-${j}`} style={cell}>
                <Hand size={4.6}>{handText(ctx, sample?.[i]?.[j])}</Hand>
              </span>
            )),
          ])}
        </div>
      </div>
    );
  },
});
