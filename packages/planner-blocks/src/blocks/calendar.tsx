import { addDays, formatDate, weekdayName, weekdayNames } from '@planner/i18n';
import type { BlockRenderContext } from '@planner/renderer';
import { PAPER, inkColor, mm, resolveText } from '@planner/renderer';
import { LocalizedText } from '@planner/schema';
import type { CSSProperties } from 'react';
import { z } from 'zod';
import { RULE, RULE_LIGHT, TYPE, WriteLine, column, fill } from '../primitives';
import { defineBlock } from '../registry';

const L = (en: string, pl: string) => ({ en, pl });

const inRange = (ctx: BlockRenderContext, iso: string) =>
  !ctx.range || (iso >= ctx.range.start && iso <= ctx.range.end);

/** Monday-first weekday index (0 = Monday) of an ISO date. */
const mondayIndex = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
};

const CalendarProps = z.object({
  /** Weekday columns shown, [from, to) with 0 = Monday: [0, 4] and [4, 7] split a spread. */
  columns: z.tuple([z.number().int().min(0).max(6), z.number().int().min(1).max(7)]),
  // The designer's select stores '5' / '6' as text.
  rows: z.union([
    z.literal(5),
    z.literal(6),
    z.literal('auto'),
    z.enum(['5', '6']).transform((v) => Number(v) as 5 | 6),
  ]),
  showWeekdays: z.boolean(),
  /** Days of the neighbouring months: greyed numbers in shaded cells, or left empty. */
  otherMonthDays: z.enum(['none', 'previous', 'previous-and-next']),
});

/** Shading of cells that belong to another month: faint enough to write over. */
const OTHER_MONTH_FILL = inkColor(0.07);

/**
 * Month grid, Monday first (§7). Split across a spread by giving each page a column range. Days
 * of neighbouring months are greyed (or left empty); days outside the planner show a light number.
 */
export const calendarGridBlock = defineBlock({
  type: 'calendar-grid',
  version: 1,
  label: L('Month calendar', 'Kalendarz miesiąca'),
  category: 'calendar',
  propsSchema: CalendarProps,
  defaults: {
    columns: [0, 7],
    rows: 'auto',
    showWeekdays: true,
    otherMonthDays: 'previous-and-next',
  },
  inspector: [
    {
      key: 'otherMonthDays',
      kind: 'select',
      label: L('Days of other months', 'Dni innych miesięcy'),
      options: [
        {
          value: 'previous-and-next',
          label: L('Previous and next month, greyed', 'Poprzedni i następny, wyszarzone'),
        },
        { value: 'previous', label: L('Previous month only', 'Tylko poprzedni miesiąc') },
        { value: 'none', label: L('Empty', 'Puste') },
      ],
    },
    {
      key: 'rows',
      kind: 'select',
      label: L('Weeks', 'Tygodnie'),
      options: [
        { value: 'auto', label: L('As needed', 'Według miesiąca') },
        { value: '5', label: L('5 (35 days)', '5 (35 dni)') },
        { value: '6', label: L('6 (42 days)', '6 (42 dni)') },
      ],
    },
  ],
  Render: ({ props, ctx }) => {
    const [from, to] = props.columns;
    const month = ctx.page.date?.slice(0, 7);
    const first = month ? `${month}-01` : undefined;
    const gridStart = first ? addDays(first, -mondayIndex(first)) : undefined;
    const nextMonthFirst = first ? `${addDays(first, 32).slice(0, 7)}-01` : undefined;
    const daysInMonth = nextMonthFirst ? Number(addDays(nextMonthFirst, -1).slice(8)) : 0;
    const needed = first ? Math.ceil((mondayIndex(first) + daysInMonth) / 7) : 5;
    const rows = props.rows === 'auto' ? needed : props.rows;
    const names = weekdayNames(ctx.locale, 'short');

    const cell: CSSProperties = {
      borderRight: RULE,
      borderBottom: RULE,
      padding: mm(1),
      boxSizing: 'border-box',
      minWidth: 0,
    };

    return (
      <div style={{ ...column }}>
        {props.showWeekdays && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${to - from}, 1fr)`,
              flex: 'none',
            }}
          >
            {names.slice(from, to).map((n) => (
              <div key={n} style={{ ...TYPE.label, padding: `0 ${mm(1)} ${mm(1)}` }}>
                {n}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            ...fill,
            display: 'grid',
            gridTemplateColumns: `repeat(${to - from}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            borderTop: RULE,
            borderLeft: RULE,
          }}
        >
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: to - from }, (_, c) => {
              const iso = gridStart ? addDays(gridStart, r * 7 + from + c) : undefined;
              const inMonth = iso && month && iso.startsWith(month);
              const other =
                iso && month && !inMonth
                  ? props.otherMonthDays === 'previous-and-next' ||
                    (props.otherMonthDays === 'previous' && iso < month)
                  : false;
              return (
                <div
                  key={`${r}-${c}`}
                  data-other-month={other || undefined}
                  style={other ? { ...cell, background: OTHER_MONTH_FILL } : cell}
                >
                  {other && (
                    <span style={{ ...TYPE.caption, fontWeight: 400, color: PAPER.rule }}>
                      {Number(iso!.slice(8))}
                    </span>
                  )}
                  {inMonth && (
                    <span
                      style={{
                        ...TYPE.caption,
                        fontWeight: 600,
                        color: inRange(ctx, iso) ? PAPER.ink : PAPER.rule,
                      }}
                    >
                      {Number(iso.slice(8))}
                    </span>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
    );
  },
});

const DayHeaderProps = z.object({
  showSobriety: z.boolean(),
  sobrietyLabel: LocalizedText,
});

/** Date and sobriety day counter at the top of the daily page (§10). */
export const dayHeaderBlock = defineBlock({
  type: 'day-header',
  version: 1,
  label: L('Date & sobriety day', 'Data i dzień trzeźwości'),
  category: 'therapeutic',
  propsSchema: DayHeaderProps,
  defaults: {
    showSobriety: true,
    sobrietyLabel: L(
      'Sobriety day number: {{sobrietyDayNumber}}',
      'Dzień trzeźwości numer: {{sobrietyDayNumber}}',
    ),
  },
  inspector: [
    { key: 'showSobriety', kind: 'boolean', label: L('Sobriety counter', 'Licznik trzeźwości') },
    { key: 'sobrietyLabel', kind: 'localized-text', label: L('Counter text', 'Tekst licznika') },
  ],
  Render: ({ props, ctx }) => {
    const date = ctx.page.date;
    return (
      <div style={{ ...column, justifyContent: 'space-between' }}>
        <div>
          {date ? (
            <>
              <div style={TYPE.heading}>{weekdayName(date, ctx.locale)}</div>
              <div style={TYPE.body}>{formatDate(date, ctx.locale, 'day-month')}</div>
            </>
          ) : (
            <WriteLine height={8} />
          )}
        </div>
        {props.showSobriety && (
          <div style={{ ...TYPE.caption, color: PAPER.ink }}>
            {resolveText(ctx, props.sobrietyLabel)}
          </div>
        )}
      </div>
    );
  },
});

/** Event markers for day strips (§8). Distinct shapes plus letters, so no colour is needed. */
export const MARKERS = {
  aa: { shape: 'circle', letter: L('A', 'A'), label: L('AA meeting', 'Mityng AA') },
  therapy: { shape: 'square', letter: L('T', 'T'), label: L('Therapy session', 'Sesja terapii') },
  doctor: { shape: 'diamond', letter: L('D', 'L'), label: L('Doctor', 'Lekarz') },
  exercise: { shape: 'triangle', letter: L('E', 'R'), label: L('Exercise', 'Ruch') },
  recovery: {
    shape: 'hexagon',
    letter: L('R', 'Z'),
    label: L('Recovery activity', 'Działanie na rzecz zdrowienia'),
  },
  risk: {
    shape: 'triangle-down',
    letter: L('!', '!'),
    label: L('High-risk day', 'Dzień podwyższonego ryzyka'),
  },
  custom: { shape: 'circle', letter: L('', ''), label: L('Your own', 'Własne') },
} as const;
export type MarkerKey = keyof typeof MARKERS;
const MARKER_KEYS = Object.keys(MARKERS) as MarkerKey[];

const SHAPES: Record<string, string> = {
  circle: 'M10 2 A8 8 0 1 1 9.99 2 Z',
  square: 'M3 3 H17 V17 H3 Z',
  diamond: 'M10 1.5 L18.5 10 L10 18.5 L1.5 10 Z',
  triangle: 'M10 2 L18.5 17.5 H1.5 Z',
  'triangle-down': 'M1.5 2.5 H18.5 L10 18 Z',
  hexagon: 'M5.5 2.5 H14.5 L19 10 L14.5 17.5 H5.5 L1 10 Z',
};

export function MarkerIcon({
  marker,
  locale,
  size = 3.8,
}: {
  marker: MarkerKey;
  locale: 'en' | 'pl';
  size?: number;
}) {
  const m = MARKERS[marker];
  return (
    <svg
      width={mm(size)}
      height={mm(size)}
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={SHAPES[m.shape]} fill="none" stroke={PAPER.line} strokeWidth={1.3} />
      <text
        x="10"
        y={m.shape === 'triangle' ? 15 : 13.8}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill={PAPER.inkMuted}
      >
        {m.letter[locale]}
      </text>
    </svg>
  );
}

const DayStripProps = z.object({
  /** 0 = Monday … 6 = Sunday; the date comes from the week page's dates. */
  weekday: z.number().int().min(0).max(6),
  markers: z.array(z.enum(MARKER_KEYS as [MarkerKey, ...MarkerKey[]])),
  lines: z.number().int().min(0).max(6),
});

/** One day of the weekly spread: date, event markers to tick, and a few lines (§8). */
export const dayStripBlock = defineBlock({
  type: 'day-strip',
  version: 1,
  label: L('Day of the week', 'Dzień tygodnia'),
  category: 'calendar',
  propsSchema: DayStripProps,
  defaults: { weekday: 0, markers: MARKER_KEYS, lines: 3 },
  inspector: [{ key: 'lines', kind: 'number', label: L('Lines', 'Linie'), min: 0, max: 6 }],
  Render: ({ props, ctx }) => {
    const date = ctx.page.dates?.[props.weekday];
    const outside = date !== undefined && !inRange(ctx, date);
    const name = date
      ? weekdayName(date, ctx.locale)
      : weekdayNames(ctx.locale, 'long')[props.weekday];
    return (
      <div style={{ ...column, borderTop: RULE, paddingTop: mm(1.2), opacity: outside ? 0.45 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: mm(2), flex: 'none' }}>
          <span style={{ ...TYPE.subheading }}>{name}</span>
          {date && <span style={TYPE.caption}>{formatDate(date, ctx.locale, 'day-month')}</span>}
          {outside && <span style={TYPE.caption}>—</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: mm(1.2) }}>
            {props.markers.map((m) => (
              <MarkerIcon key={m} marker={m} locale={ctx.locale} />
            ))}
          </span>
        </div>
        <div style={{ ...fill, display: 'flex', flexDirection: 'column' }}>
          {Array.from({ length: props.lines }, (_, i) => (
            <div
              key={i}
              style={{ ...fill, borderBottom: i === props.lines - 1 ? 'none' : RULE_LIGHT }}
            />
          ))}
        </div>
      </div>
    );
  },
});

/** Explains the day-strip marker shapes; printed once per weekly spread. */
export const markerLegendBlock = defineBlock({
  type: 'marker-legend',
  version: 1,
  label: L('Marker legend', 'Legenda znaczników'),
  category: 'calendar',
  propsSchema: z.object({ markers: z.array(z.enum(MARKER_KEYS as [MarkerKey, ...MarkerKey[]])) }),
  defaults: { markers: MARKER_KEYS },
  inspector: [],
  Render: ({ props, ctx }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${mm(1)} ${mm(3)}`, ...TYPE.caption }}>
      {props.markers.map((m) => (
        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: mm(1) }}>
          <MarkerIcon marker={m} locale={ctx.locale} size={3.2} />
          {resolveText(ctx, MARKERS[m].label)}
        </span>
      ))}
    </div>
  ),
});
