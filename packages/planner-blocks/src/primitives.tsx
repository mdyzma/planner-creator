import type { BlockRenderContext } from '@planner/renderer';
import { FillPattern, PAPER, mm } from '@planner/renderer';
import type { LocalizedText, PatternSpec } from '@planner/schema';
import type { CSSProperties, ReactNode } from 'react';
import type { z } from 'zod';

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
  children,
}: {
  pattern: PatternSpec;
  style?: CSSProperties;
  /** Laid over the pattern, e.g. example handwriting. */
  children?: ReactNode;
}) {
  return (
    <div style={{ ...fill, position: 'relative', overflow: 'hidden', ...style }}>
      <FillPattern spec={pattern} />
      {children}
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

// ---------------------------------------------------------------------------------------------
// Example handwriting (the guide and "example" exports only, §4.3 sampleContent)

/** Pencil-grey ink for example entries; notes are lighter still. */
export const HAND_INK = '#5f666d';
export const NOTE_INK = '#8a9096';

/** Handwriting style; the font is self-hosted by the app as --planner-hand. */
export const HAND: CSSProperties = {
  fontFamily: 'var(--planner-hand, "Caveat", "Segoe Print", "Comic Sans MS", cursive)',
  color: HAND_INK,
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

/** The block's example fill, if example mode is on and it matches the block's sample shape. */
export function sampleFill<T>(
  ctx: BlockRenderContext,
  blockId: string,
  schema: z.ZodType<T>,
): T | undefined {
  const fill = ctx.sample?.(blockId)?.fill;
  if (fill === undefined) return undefined;
  const parsed = schema.safeParse(fill);
  return parsed.success ? parsed.data : undefined;
}

/** Example text in the page language (samples are written in both languages). */
export const handText = (ctx: BlockRenderContext, text: LocalizedText | string | undefined) =>
  text === undefined ? '' : typeof text === 'string' ? text : (text[ctx.locale] ?? '');

/** A handwritten word or phrase, sized in mm. */
export function Hand({
  children,
  size = 4.8,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  if (children === '' || children === undefined || children === null) return null;
  return <span style={{ ...HAND, fontSize: mm(size), ...style }}>{children}</span>;
}

/**
 * Handwritten lines laid over a lined writing surface: one line of text per `pitch` mm, resting
 * on the rule. Lines are separated by "\n" in the sample text.
 */
export function HandLines({
  text,
  pitch,
  inset = 0,
}: {
  text: string;
  pitch: number;
  inset?: number;
}) {
  if (!text) return null;
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: `0 ${mm(inset)}`, pointerEvents: 'none' }}
    >
      {text.split('\n').map((line, i) => (
        <div
          key={i}
          style={{
            height: mm(pitch),
            display: 'flex',
            alignItems: 'flex-end',
            paddingBottom: mm(pitch * 0.12),
            paddingLeft: mm(1.5),
            boxSizing: 'border-box',
          }}
        >
          <Hand size={pitch * 0.72}>{line}</Hand>
        </div>
      ))}
    </div>
  );
}

/** A hand-drawn ring around a mark (a chosen scale value, a ticked event marker). */
export function HandRing({ size = 5 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: mm(size),
        height: mm(size),
        transform: 'translate(-50%, -50%) rotate(-12deg)',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <path
        d="M10 1.5 C15.5 1.2 18.8 5 18.6 10.2 C18.4 15.6 14.2 18.9 9.6 18.6 C4.6 18.3 1.3 14.6 1.6 9.6 C1.9 5.2 5.2 2.4 11.5 2.6"
        fill="none"
        stroke={HAND_INK}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
