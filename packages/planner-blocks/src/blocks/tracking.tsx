import { mm, resolveText } from '@planner/renderer';
import { LocalizedText } from '@planner/schema';
import { z } from 'zod';
import { BlockTitle, Mark, RULE, RULE_LIGHT, TYPE, column, fill } from '../primitives';
import { defineBlock } from '../registry';

const L = (en: string, pl: string) => ({ en, pl });

const RatingProps = z.object({
  title: LocalizedText.optional(),
  rows: z
    .array(z.object({ label: LocalizedText, badge: z.string().max(3).optional() }))
    .min(1)
    .max(12),
  mode: z.enum(['checkbox', 'scale-1-5', 'scale-0-10']),
  noteColumn: z.boolean(),
  noteLabel: LocalizedText.optional(),
});

const SCALES = {
  checkbox: [] as number[],
  'scale-1-5': [1, 2, 3, 4, 5],
  'scale-0-10': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

/**
 * Rows rated by hand: HALT check, habits, moods (§12). Each row has a letter badge and printed
 * numbers in its circles, so it reads without colour.
 */
export const ratingMatrixBlock = defineBlock({
  type: 'rating-matrix',
  version: 1,
  label: L('Rating table', 'Tabela ocen'),
  category: 'tracking',
  propsSchema: RatingProps,
  defaults: { rows: [{ label: L('Item', 'Pozycja') }], mode: 'scale-1-5', noteColumn: false },
  inspector: [
    { key: 'title', kind: 'localized-text', label: L('Title', 'Tytuł') },
    {
      key: 'mode',
      kind: 'select',
      label: L('Answer type', 'Sposób oceny'),
      options: [
        { value: 'checkbox', label: L('Tick box', 'Pole wyboru') },
        { value: 'scale-1-5', label: L('Scale 1–5', 'Skala 1–5') },
        { value: 'scale-0-10', label: L('Scale 0–10', 'Skala 0–10') },
      ],
    },
    { key: 'noteColumn', kind: 'boolean', label: L('Note column', 'Kolumna na notatkę') },
  ],
  Render: ({ props, ctx }) => {
    const scale = SCALES[props.mode];
    const circle = props.mode === 'scale-0-10' ? 3.1 : 3.6;
    return (
      <div style={column}>
        <BlockTitle>{resolveText(ctx, props.title)}</BlockTitle>
        <div style={{ ...column, gap: mm(0.5) }}>
          {props.rows.map((row, i) => (
            <div
              key={i}
              style={{
                ...fill,
                display: 'flex',
                alignItems: 'center',
                gap: mm(2),
                borderBottom: i < props.rows.length - 1 ? RULE_LIGHT : undefined,
              }}
            >
              {row.badge && (
                <span
                  style={{
                    ...TYPE.subheading,
                    width: mm(6),
                    height: mm(6),
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: RULE,
                    borderRadius: mm(1),
                  }}
                >
                  {row.badge}
                </span>
              )}
              <span style={{ ...TYPE.body, width: props.noteColumn ? '30%' : '40%', flex: 'none' }}>
                {resolveText(ctx, row.label)}
              </span>
              <span style={{ display: 'flex', gap: mm(1.2), alignItems: 'center', flex: 'none' }}>
                {props.mode === 'checkbox' ? (
                  <Mark shape="box" />
                ) : (
                  scale.map((n) => (
                    <Mark key={n} shape="circle" size={circle}>
                      {n}
                    </Mark>
                  ))
                )}
              </span>
              {props.noteColumn && (
                <span
                  style={{
                    ...fill,
                    alignSelf: 'stretch',
                    borderBottom: RULE,
                    marginBottom: mm(1.5),
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  <span style={TYPE.caption}>{resolveText(ctx, props.noteLabel)}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },
});

const TimeGridProps = z.object({
  title: LocalizedText.optional(),
  from: z.number().int().min(0).max(23),
  to: z.number().int().min(1).max(24),
  stepMinutes: z.union([z.literal(30), z.literal(60)]),
  linesPerSlot: z.number().int().min(1).max(3),
});

/** Optional hour-by-hour schedule (§13), e.g. 07:00–18:00 with two lines per hour. */
export const timeGridBlock = defineBlock({
  type: 'time-grid',
  version: 1,
  label: L('Schedule', 'Plan godzinowy'),
  category: 'calendar',
  propsSchema: TimeGridProps,
  defaults: { from: 7, to: 18, stepMinutes: 60, linesPerSlot: 1 },
  inspector: [
    { key: 'title', kind: 'localized-text', label: L('Title', 'Tytuł') },
    { key: 'from', kind: 'number', label: L('From hour', 'Od godziny'), min: 0, max: 23 },
    { key: 'to', kind: 'number', label: L('To hour', 'Do godziny'), min: 1, max: 24 },
    {
      key: 'linesPerSlot',
      kind: 'number',
      label: L('Lines per slot', 'Linie na przedział'),
      min: 1,
      max: 3,
    },
  ],
  Render: ({ props, ctx }) => {
    const slots: string[] = [];
    // Both ends are included (07:00 … 18:00); there is no 24:00 slot.
    for (let m = props.from * 60; m <= props.to * 60 && m < 24 * 60; m += props.stepMinutes) {
      slots.push(
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      );
    }
    return (
      <div style={column}>
        <BlockTitle>{resolveText(ctx, props.title)}</BlockTitle>
        <div style={column}>
          {slots.map((time) => (
            <div key={time} style={{ ...fill, display: 'flex', gap: mm(1.5) }}>
              <span
                style={{
                  ...TYPE.caption,
                  width: mm(8.5),
                  flex: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  alignSelf: 'flex-end',
                  paddingBottom: mm(0.5),
                }}
              >
                {time}
              </span>
              <div style={{ ...fill, display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: props.linesPerSlot }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      ...fill,
                      borderBottom: i === props.linesPerSlot - 1 ? RULE : RULE_LIGHT,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
});
