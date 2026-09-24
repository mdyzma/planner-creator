import type { Length } from '@planner/schema';
import type { CSSProperties } from 'react';

/** Everything is laid out in physical millimetres; zoom is applied outside the page (§8.1). */
export const mm = (value: number): string => `${round(value)}mm`;

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Flex sizing along a stack/row's main axis. Undefined sizes share the remaining space. */
export function flexFor(length: Length | undefined): CSSProperties {
  if (length === undefined) return { flex: '1 1 0' };
  if (length === 'auto') return { flex: '0 0 auto' };
  if ('mm' in length) return { flex: `0 0 ${mm(length.mm)}` };
  return { flex: `${length.fr} 1 0` };
}

/** Grey for an ink value 0–1 (1 = black). Print subtlety comes from value, not opacity (§8.2). */
export function inkColor(ink: number): string {
  const v = Math.round(255 * (1 - Math.min(1, Math.max(0, ink))));
  return `rgb(${v}, ${v}, ${v})`;
}

/** Colours used on printed pages; kept in one place for the M3 theme tokens. */
export const PAPER = {
  paper: '#ffffff',
  ink: '#1e2424',
  inkMuted: '#525c5a',
  rule: inkColor(0.45),
} as const;
