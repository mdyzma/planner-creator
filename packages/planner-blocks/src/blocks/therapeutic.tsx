import { PAPER, mm, resolveText } from '@planner/renderer';
import { LocalizedText } from '@planner/schema';
import { z } from 'zod';
import {
  BlockTitle,
  HAND_INK,
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
import { CategorySample, ContactSample, WheelSample } from '../samples';
import { defineBlock } from '../registry';

const L = (en: string, pl: string) => ({ en, pl });

const WheelProps = z.object({
  segments: z.array(LocalizedText).min(3).max(12),
  max: z.number().int().min(3).max(10),
});

/** Splits a label into at most two lines near its middle, so it fits beside the wheel. */
function twoLines(text: string): string[] {
  if (text.length <= 12) return [text];
  const middle = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))) best = i;
  }
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

/**
 * Wheel of Life (§15): segments with rings 1–max, printed blank for colouring by hand. Numbers
 * on one spoke make the rings readable in grayscale.
 */
export const radialScaleBlock = defineBlock({
  type: 'radial-scale',
  version: 1,
  label: L('Wheel of Life', 'Koło Życia'),
  category: 'therapeutic',
  propsSchema: WheelProps,
  defaults: {
    segments: [
      L('Physical health and sleep', 'Zdrowie fizyczne i sen'),
      L('Emotions and inner calm', 'Emocje i spokój'),
      L('Sobriety and 12 Steps', 'Trzeźwość i 12 Kroków'),
      L('Relationships and intimacy', 'Relacje i bliskość'),
      L('Finances', 'Finanse'),
      L('Work', 'Praca'),
      L('Personal growth', 'Rozwój'),
      L('Rest and recreation', 'Odpoczynek'),
    ],
    max: 10,
  },
  inspector: [
    { key: 'segments', kind: 'localized-list', label: L('Areas', 'Obszary') },
    { key: 'max', kind: 'number', label: L('Scale maximum', 'Maksimum skali'), min: 3, max: 10 },
  ],
  Render: ({ props, block, ctx }) => {
    const scores = sampleFill(ctx, block.id, WheelSample);
    // Wider than tall: labels beside the wheel need more room than those above and below.
    const width = 320;
    const height = 240;
    const cx = width / 2;
    const cy = height / 2;
    const radius = 78;
    const n = props.segments.length;
    const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
    const at = (a: number, r: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={resolveText(ctx, L('Wheel of Life', 'Koło Życia'))}
      >
        {scores && (
          <defs>
            <pattern
              id={`hand-hatch-${block.id}`}
              width="3"
              height="3"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <line x1="0" y1="0" x2="0" y2="3" stroke={HAND_INK} strokeWidth="0.9" />
            </pattern>
          </defs>
        )}
        {scores?.map((score, i) => {
          // Example scores: each area shaded from the centre out to its score, as if coloured in.
          const r = (radius * Math.min(score, props.max)) / props.max;
          if (i >= n || r <= 0) return null;
          const [x1, y1] = at(angle(i), r);
          const [x2, y2] = at(angle(i + 1), r);
          return (
            <path
              key={`s${i}`}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
              fill={`url(#hand-hatch-${block.id})`}
              stroke={HAND_INK}
              strokeWidth={0.9}
              opacity={0.75}
            />
          );
        })}
        {Array.from({ length: props.max }, (_, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={(radius * (i + 1)) / props.max}
            fill="none"
            stroke={PAPER.line}
            strokeWidth={i === props.max - 1 ? 0.8 : 0.35}
            strokeDasharray={i === props.max - 1 ? undefined : '1.5 1.5'}
          />
        ))}
        {props.segments.map((_, i) => {
          const [x, y] = at(angle(i), radius);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={PAPER.line} strokeWidth={0.6} />
          );
        })}
        {Array.from({ length: props.max }, (_, i) => {
          // Ring numbers along the first spoke, nudged sideways to stay off the line.
          const r = (radius * (i + 1)) / props.max;
          return (
            <text key={i} x={cx + 2} y={cy - r + 3} fontSize="5" fill={PAPER.inkMuted}>
              {i + 1}
            </text>
          );
        })}
        {props.segments.map((segment, i) => {
          const mid = angle(i + 0.5);
          const [x, y] = at(mid, radius + 8);
          const cos = Math.cos(mid);
          const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
          const lines = twoLines(resolveText(ctx, segment));
          const dy =
            Math.sin(mid) > 0.25
              ? 4
              : Math.sin(mid) < -0.25
                ? -(lines.length - 1) * 8
                : -(lines.length - 1) * 4 + 2;
          return (
            <text key={i} x={x} y={y + dy} fontSize="7.5" fill={PAPER.ink} textAnchor={anchor}>
              {lines.map((line, j) => (
                <tspan key={j} x={x} dy={j === 0 ? 0 : 8.5}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
    );
  },
});

const CategoryGridProps = z.object({
  columns: z.union([z.literal(1), z.literal(2)]),
  cells: z
    .array(
      z.object({
        title: LocalizedText,
        /** Printed examples to prompt the writer, e.g. warning signs (§17). */
        examples: z.array(LocalizedText),
      }),
    )
    .min(1)
    .max(8),
  pattern: z.enum(['lines', 'dots', 'blank']),
  examplesLabel: LocalizedText,
});

/**
 * Boxes with editable headings and example prompts: warning signs by area (§17) and the
 * gains/losses balance (§18).
 */
export const categoryGridBlock = defineBlock({
  type: 'category-grid',
  version: 1,
  label: L('Category boxes', 'Pola kategorii'),
  category: 'therapeutic',
  propsSchema: CategoryGridProps,
  defaults: {
    columns: 2,
    cells: [{ title: L('Category', 'Kategoria'), examples: [] }],
    pattern: 'lines',
    examplesLabel: L('e.g.', 'np.'),
  },
  inspector: [
    {
      key: 'columns',
      kind: 'select',
      label: L('Columns', 'Kolumny'),
      options: [
        { value: '1', label: L('One', 'Jedna') },
        { value: '2', label: L('Two', 'Dwie') },
      ],
    },
  ],
  Render: ({ props, block, ctx }) => {
    const rows = Math.ceil(props.cells.length / props.columns);
    const sample = sampleFill(ctx, block.id, CategorySample);
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: mm(3),
          height: '100%',
        }}
      >
        {props.cells.map((cell, i) => (
          <section
            key={i}
            style={{
              ...column,
              border: RULE,
              borderRadius: mm(1.5),
              padding: mm(2.5),
              boxSizing: 'border-box',
            }}
          >
            <div style={{ ...TYPE.subheading, marginBottom: mm(1), flex: 'none' }}>
              {resolveText(ctx, cell.title)}
            </div>
            {cell.examples.length > 0 && (
              <div
                style={{
                  ...TYPE.caption,
                  fontStyle: 'italic',
                  marginBottom: mm(1.5),
                  flex: 'none',
                }}
              >
                {resolveText(ctx, props.examplesLabel)}{' '}
                {cell.examples.map((e) => resolveText(ctx, e)).join(' · ')}
              </div>
            )}
            <WritingSurface
              pattern={{ kind: props.pattern, pitch: props.pattern === 'lines' ? 7 : 5, ink: 0.5 }}
            >
              {sample?.[i] !== undefined && (
                <HandLines
                  text={handText(ctx, sample[i])}
                  pitch={props.pattern === 'lines' ? 7 : 10}
                />
              )}
            </WritingSurface>
          </section>
        ))}
      </div>
    );
  },
});

const ContactProps = z.object({
  title: LocalizedText.optional(),
  roles: z.array(LocalizedText).min(1).max(10),
  fields: z.array(LocalizedText).min(1).max(6),
});

/**
 * Support network (§19): one card per role with labelled lines. Numbers are never pre-filled by
 * location; the patient writes their own.
 */
export const contactTableBlock = defineBlock({
  type: 'contact-table',
  version: 1,
  label: L('Contacts', 'Kontakty'),
  category: 'therapeutic',
  propsSchema: ContactProps,
  defaults: {
    roles: [L('Contact', 'Kontakt')],
    fields: [
      L('Name', 'Imię i nazwisko'),
      L('Phone', 'Telefon'),
      L('Alternative phone', 'Telefon dodatkowy'),
      L('Notes', 'Uwagi'),
    ],
  },
  inspector: [
    { key: 'title', kind: 'localized-text', label: L('Title', 'Tytuł') },
    { key: 'roles', kind: 'localized-list', label: L('People', 'Osoby') },
    { key: 'fields', kind: 'localized-list', label: L('Fields', 'Pola') },
  ],
  Render: ({ props, block, ctx }) => {
    const sample = sampleFill(ctx, block.id, ContactSample);
    return (
      <div style={column}>
        <BlockTitle>{resolveText(ctx, props.title)}</BlockTitle>
        <div
          style={{
            ...fill,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridAutoRows: '1fr',
            gap: mm(3),
          }}
        >
          {props.roles.map((role, i) => (
            <section
              key={i}
              style={{
                ...column,
                border: RULE,
                borderRadius: mm(1.5),
                padding: mm(2.5),
                boxSizing: 'border-box',
              }}
            >
              <div style={{ ...TYPE.subheading, flex: 'none' }}>{resolveText(ctx, role)}</div>
              {props.fields.map((field, f) => (
                <WriteLine key={f} height={6.5} style={{ flex: 1 }}>
                  <span style={{ ...TYPE.caption, width: mm(22), flex: 'none' }}>
                    {resolveText(ctx, field)}
                  </span>
                  <Hand size={4.2}>{handText(ctx, sample?.[i]?.[f])}</Hand>
                </WriteLine>
              ))}
            </section>
          ))}
        </div>
      </div>
    );
  },
});

/** Horizontal rule between sections of a page. */
export const dividerBlock = defineBlock({
  type: 'divider',
  version: 1,
  label: L('Divider', 'Linia podziału'),
  category: 'layout',
  propsSchema: z.object({}),
  defaults: {},
  inspector: [],
  Render: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
      <div style={{ ...fill, borderTop: RULE }} />
    </div>
  ),
});

/**
 * A picture, scaled to fit the block and centred. `src` is a URL or a data URI; templates embed
 * theirs as data URIs so that the template JSON stays self-contained.
 */
export const imageBlock = defineBlock({
  type: 'image',
  version: 1,
  label: L('Image', 'Obraz'),
  category: 'layout',
  propsSchema: z.object({ src: z.string(), alt: LocalizedText.optional() }),
  defaults: { src: '' },
  inspector: [{ key: 'alt', kind: 'localized-text', label: L('Description', 'Opis') }],
  Render: ({ props, ctx }) =>
    props.src ? (
      <img
        src={props.src}
        alt={props.alt ? resolveText(ctx, props.alt) : ''}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
      />
    ) : null,
});

/** Empty space; its size comes from the layout. */
export const spacerBlock = defineBlock({
  type: 'spacer',
  version: 1,
  label: L('Spacer', 'Odstęp'),
  category: 'layout',
  propsSchema: z.object({}),
  defaults: {},
  inspector: [],
  Render: () => null,
});
