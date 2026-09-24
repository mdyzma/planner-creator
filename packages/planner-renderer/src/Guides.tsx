import type { Box, PageFrame } from '@planner/core';
import type { CSSProperties } from 'react';
import { mm } from './units';

const box = (b: Box): CSSProperties => ({
  position: 'absolute',
  left: mm(b.x),
  top: mm(b.y),
  width: mm(b.w),
  height: mm(b.h),
  boxSizing: 'border-box',
  pointerEvents: 'none',
});

/** Screen-only overlays: binding zone, holes, margins, rail and printer-safe edge (§9.3). */
export function Guides({
  frame,
  printerSafeMargin,
}: {
  frame: PageFrame;
  printerSafeMargin: number;
}) {
  const { trim } = frame;
  const safe = printerSafeMargin;
  return (
    <div
      data-guides
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {/* Binding zone: hatched so it reads without colour. */}
      <div
        data-guide="binding"
        style={{
          ...box(frame.bindingZone),
          background:
            'repeating-linear-gradient(135deg, rgba(37, 99, 235, 0.14) 0 1.5mm, transparent 1.5mm 3mm)',
          [frame.bindingEdge === 'left' ? 'borderRight' : 'borderLeft']:
            '0.2mm solid rgba(37, 99, 235, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: mm(4),
        }}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            fontSize: '6pt',
            letterSpacing: '0.1em',
            color: 'rgb(29, 78, 216)',
          }}
        >
          BINDING
        </span>
      </div>
      {frame.holes.map((h, i) => (
        <div
          key={i}
          data-guide="hole"
          style={{
            position: 'absolute',
            left: mm(h.cx - h.d / 2),
            top: mm(h.cy - h.d / 2),
            width: mm(h.d),
            height: mm(h.d),
            borderRadius: '50%',
            border: '0.3mm solid rgb(29, 78, 216)',
            background: 'rgba(29, 78, 216, 0.12)',
          }}
        />
      ))}
      {/* Printer-safe edge: home printers cannot print outside this line. */}
      <div
        data-guide="printer-safe"
        style={{
          ...box({ x: safe, y: safe, w: trim.w - 2 * safe, h: trim.h - 2 * safe }),
          border: '0.2mm dotted rgba(155, 28, 28, 0.55)',
        }}
      />
      <div
        data-guide="content"
        style={{ ...box(frame.content), border: '0.2mm dashed rgba(15, 111, 102, 0.7)' }}
      />
      {frame.outerRail && (
        <div
          data-guide="outer-rail"
          style={{
            ...box(frame.outerRail),
            background: 'rgba(217, 119, 6, 0.08)',
            border: '0.2mm dashed rgba(217, 119, 6, 0.7)',
          }}
        />
      )}
    </div>
  );
}
