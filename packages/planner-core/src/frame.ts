import type { FormatId, PrintSettings, Side } from '@planner/schema';
import { PAGE_FORMATS } from '@planner/schema';

/** Rectangle in mm, relative to the trim box's top-left corner. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hole {
  cx: number;
  cy: number;
  d: number;
}

export interface FrameWarning {
  code: 'margin-below-printer-safe' | 'inner-margin-in-hole-zone';
  margin: 'inner' | 'outer' | 'top' | 'bottom';
  requestedMm: number;
  appliedMm: number;
}

/** Physical geometry of one page (§5.1). All values in mm, relative to the trim box. */
export interface PageFrame {
  format: FormatId;
  side: Side;
  trim: { w: number; h: number };
  bleed: number;
  bindingEdge: 'left' | 'right';
  /** Physical margins after clamping. */
  margins: { left: number; right: number; top: number; bottom: number };
  /** Everything inside the margins. */
  content: Box;
  /** Main layout area: the content box minus the outer rail. */
  body: Box;
  /** Strip at the outer edge of the content box for pinned blocks; absent when width is 0. */
  outerRail?: Box;
  /** From the binding edge to the inner margin: hidden or punched in the bound planner. */
  bindingZone: Box;
  holes: Hole[];
  warnings: FrameWarning[];
}

/** Space between the outer rail and the body. */
export const RAIL_GAP_MM = 4;
/** Clearance kept between a punched hole's edge and the content. */
export const HOLE_CLEARANCE_MM = 3;

/** Smallest inner margin that keeps content clear of the binding hardware. */
export function minimumInnerMargin(print: PrintSettings): number {
  const b = print.binding;
  if (b.kind !== 'ring') return 0;
  return b.holeCentreFromEdge + b.holeDiameter / 2 + HOLE_CLEARANCE_MM;
}

/**
 * Resolves logical margins (inner/outer) into physical left/right for one page side, clamps them
 * to what the printer and binding allow, and derives the content, rail and binding boxes.
 */
export function resolveFrame(
  format: FormatId,
  print: PrintSettings,
  side: Side,
  /** Page-template rail width; falls back to the print setting. */
  outerRailWidth: number = print.outerRail,
): PageFrame {
  const { width: w, height: h } = PAGE_FORMATS[format];
  const warnings: FrameWarning[] = [];

  const clamp = (
    margin: FrameWarning['margin'],
    requested: number,
    min: number,
    code: FrameWarning['code'],
  ) => {
    if (requested >= min) return requested;
    warnings.push({ code, margin, requestedMm: requested, appliedMm: min });
    return min;
  };

  const safe = print.printerSafeMargin;
  const minInner = minimumInnerMargin(print);
  const inner =
    minInner > safe
      ? clamp('inner', print.margins.inner, minInner, 'inner-margin-in-hole-zone')
      : clamp('inner', print.margins.inner, safe, 'margin-below-printer-safe');
  const outer = clamp('outer', print.margins.outer, safe, 'margin-below-printer-safe');
  const top = clamp('top', print.margins.top, safe, 'margin-below-printer-safe');
  const bottom = clamp('bottom', print.margins.bottom, safe, 'margin-below-printer-safe');

  // Right-hand pages are bound on their left edge; left-hand pages on their right edge.
  const bindingEdge = side === 'right' ? 'left' : 'right';
  const left = bindingEdge === 'left' ? inner : outer;
  const right = bindingEdge === 'left' ? outer : inner;

  const content: Box = { x: left, y: top, w: w - left - right, h: h - top - bottom };

  const railWidth = Math.min(outerRailWidth, Math.max(0, content.w - RAIL_GAP_MM));
  let body = content;
  let outerRail: Box | undefined;
  if (railWidth > 0) {
    const bodyWidth = content.w - railWidth - RAIL_GAP_MM;
    if (bindingEdge === 'left') {
      body = { ...content, w: bodyWidth };
      outerRail = {
        x: content.x + content.w - railWidth,
        y: content.y,
        w: railWidth,
        h: content.h,
      };
    } else {
      outerRail = { x: content.x, y: content.y, w: railWidth, h: content.h };
      body = { ...content, x: content.x + railWidth + RAIL_GAP_MM, w: bodyWidth };
    }
  }

  const bindingZone: Box =
    bindingEdge === 'left' ? { x: 0, y: 0, w: inner, h } : { x: w - inner, y: 0, w: inner, h };

  const binding = print.binding;
  const holes: Hole[] =
    binding.kind === 'ring'
      ? binding.holePositions.map((cy) => ({
          cx: bindingEdge === 'left' ? binding.holeCentreFromEdge : w - binding.holeCentreFromEdge,
          cy,
          d: binding.holeDiameter,
        }))
      : [];

  return {
    format,
    side,
    trim: { w, h },
    bleed: print.bleed,
    bindingEdge,
    margins: { left, right, top, bottom },
    content,
    body,
    outerRail,
    bindingZone,
    holes,
    warnings,
  };
}
