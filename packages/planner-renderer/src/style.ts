import type { BlockStyle } from '@planner/schema';
import type { CSSProperties } from 'react';
import { PAPER, mm } from './units';

/** Theme font tokens a block may use; anything else falls back to the planner font. */
export const FONT_TOKENS = {
  sans: PAPER.font,
  serif: 'Georgia, "Times New Roman", serif',
} as const;

/** Theme colour tokens; printed pages stay monochrome (§8.2). */
export const COLOR_TOKENS = {
  ink: PAPER.ink,
  muted: PAPER.inkMuted,
  rule: PAPER.rule,
  line: PAPER.line,
} as const;

const token = <T extends Record<string, string>>(map: T, key: string | undefined) =>
  key && key in map ? map[key as keyof T] : undefined;

const ALIGN = { start: 'left', center: 'center', end: 'right', justify: 'justify' } as const;

/**
 * Typography from a block's style. Blocks spread this over their own text styles, so a size set
 * in the designer wins over the block's built-in type scale.
 */
export function typographyCss(style: BlockStyle | undefined): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  const font = token(FONT_TOKENS, style.fontToken);
  if (font) css.fontFamily = font;
  if (style.fontSizePt !== undefined) css.fontSize = `${style.fontSizePt}pt`;
  if (style.fontWeight !== undefined) css.fontWeight = style.fontWeight;
  if (style.lineHeight !== undefined) css.lineHeight = style.lineHeight;
  if (style.letterSpacingEm !== undefined) css.letterSpacing = `${style.letterSpacingEm}em`;
  if (style.align) css.textAlign = ALIGN[style.align];
  const color = token(COLOR_TOKENS, style.colorToken);
  if (color) css.color = color;
  return css;
}

/** The block's box: padding, border and corner radius, plus inherited typography. */
export function boxCss(style: BlockStyle | undefined): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = typographyCss(style);
  if (style.padding !== undefined) css.padding = mm(style.padding);
  if (style.borderWidthPt) {
    css.border = `${style.borderWidthPt}pt solid ${token(COLOR_TOKENS, style.borderToken) ?? PAPER.line}`;
  }
  if (style.radius !== undefined) css.borderRadius = mm(style.radius);
  if (css.padding || css.border) css.boxSizing = 'border-box';
  return css;
}
