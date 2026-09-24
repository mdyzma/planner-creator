import type { PatternSpec } from '@planner/schema';
import { useId } from 'react';
import { PX_PER_MM, inkColor } from './units';

/** Dot 0.25 mm radius and 0.1 mm rules stay visible in print but subtle (§8.2). */
const DOT_RADIUS_MM = 0.25;
const RULE_WIDTH_MM = 0.1;
const DEFAULT_INK = 0.45;

/**
 * Writing-surface pattern drawn as inline SVG in mm, so print output stays vector.
 * Dots sit in the centre of each cell, so the first row and column are half a pitch inside the box.
 */
export function Pattern({
  spec,
  width,
  height,
}: {
  spec: PatternSpec;
  width: number;
  height: number;
}) {
  const id = useId().replace(/:/g, '');
  if (spec.kind === 'blank') return null;

  const pitch = spec.pitch && spec.pitch > 0 ? spec.pitch : 5;
  const color = inkColor(spec.ink ?? DEFAULT_INK);

  let cell;
  if (spec.kind === 'dots') {
    cell = <circle cx={pitch / 2} cy={pitch / 2} r={DOT_RADIUS_MM} fill={color} />;
  } else if (spec.kind === 'lines') {
    cell = (
      <line x1={0} y1={pitch} x2={pitch} y2={pitch} stroke={color} strokeWidth={RULE_WIDTH_MM} />
    );
  } else {
    cell = (
      <path
        d={`M ${pitch} 0 L 0 0 L 0 ${pitch}`}
        fill="none"
        stroke={color}
        strokeWidth={RULE_WIDTH_MM}
      />
    );
  }

  return (
    <svg
      aria-hidden="true"
      data-pattern={spec.kind}
      width={`${width}mm`}
      height={`${height}mm`}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <defs>
        <pattern id={id} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          {cell}
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Pattern that fills whatever box it is placed in (writing areas, lined answers), without knowing
 * the box size. Drawn in CSS pixels, which are absolute (96 px = 25.4 mm), so pitch stays exact
 * in print and the output stays vector.
 */
export function FillPattern({ spec }: { spec: PatternSpec }) {
  const id = useId().replace(/:/g, '');
  if (spec.kind === 'blank') return null;

  const pitch = (spec.pitch && spec.pitch > 0 ? spec.pitch : 5) * PX_PER_MM;
  const color = inkColor(spec.ink ?? DEFAULT_INK);
  const stroke = RULE_WIDTH_MM * PX_PER_MM;

  let cell;
  if (spec.kind === 'dots') {
    cell = <circle cx={pitch / 2} cy={pitch / 2} r={DOT_RADIUS_MM * PX_PER_MM} fill={color} />;
  } else if (spec.kind === 'lines') {
    // The rule sits at the bottom of each cell, so text is written above it.
    cell = (
      <line
        x1={0}
        y1={pitch - stroke / 2}
        x2={pitch}
        y2={pitch - stroke / 2}
        stroke={color}
        strokeWidth={stroke}
      />
    );
  } else {
    cell = (
      <path
        d={`M ${pitch} ${stroke / 2} L ${stroke / 2} ${stroke / 2} L ${stroke / 2} ${pitch}`}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
      />
    );
  }

  return (
    <svg
      aria-hidden="true"
      data-pattern={spec.kind}
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0 }}
    >
      <defs>
        <pattern id={id} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          {cell}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
