import { FillPattern, PAPER, mm } from '@planner/renderer';
import type { PatternSpec } from '@planner/schema';
import type { CSSProperties, ReactNode } from 'react';

/** Printed typography, in points (§8.2). */
export const TYPE = {
  heading: { fontSize: '16pt', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.15 },
  subheading: { fontSize: '11pt', fontWeight: 600, lineHeight: 1.2 },
  body: { fontSize: '9pt', fontWeight: 400, lineHeight: 1.35 },
  caption: { fontSize: '7.5pt', fontWeight: 400, lineHeight: 1.3, color: PAPER.inkMuted },
  label: {
    fontSize: '7.5pt',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: PAPER.inkMuted,
    lineHeight: 1.2,
  },
} satisfies Record<string, CSSProperties>;

/** Hairline used for ruled lines and boxes: 0.1 mm ≈ 0.3 pt (§8.2). */
export const RULE = `${mm(0.1)} solid ${PAPER.line}`;
export const RULE_LIGHT = `${mm(0.1)} dotted ${PAPER.rule}`;

export const fill: CSSProperties = { flex: '1 1 0', minHeight: 0, minWidth: 0 };
export const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
};

/** Small uppercase section title above a block's writing space. */
export function BlockTitle({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div style={{ ...TYPE.label, marginBottom: mm(1.5), flex: 'none' }}>{children}</div>;
}

/** A writing surface filling the remaining space: ruled lines, dot grid, squares or blank. */
export function WritingSurface({
  pattern,
  style,
}: {
  pattern: PatternSpec;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...fill, position: 'relative', overflow: 'hidden', ...style }}>
      <FillPattern spec={pattern} />
    </div>
  );
}

/** A single handwriting line of fixed height, for list items and form fields. */
export function WriteLine({
  height = 7,
  light = false,
  children,
  style,
}: {
  height?: number;
  light?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        minHeight: mm(height),
        borderBottom: light ? RULE_LIGHT : RULE,
        display: 'flex',
        alignItems: 'flex-end',
        gap: mm(1.5),
        paddingBottom: mm(0.6),
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Empty tick box or scale circle; shape alone carries meaning, not colour (§34). */
export function Mark({
  shape,
  size = 3.4,
  children,
}: {
  shape: 'box' | 'circle';
  size?: number;
  children?: ReactNode;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: mm(size),
        height: mm(size),
        flex: 'none',
        border: `${mm(0.2)} solid ${PAPER.line}`,
        borderRadius: shape === 'circle' ? '50%' : mm(0.5),
        fontSize: '5.5pt',
        color: PAPER.inkMuted,
        boxSizing: 'border-box',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

/** Opening and closing quotation marks for the page language. */
export const quoteMarks = (locale: string): [string, string] =>
  locale === 'pl' ? ['„', '”'] : ['“', '”'];
