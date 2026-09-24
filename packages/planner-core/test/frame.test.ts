import { PAGE_FORMATS, createProject, defaultPrintSettings } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import { minimumInnerMargin, padToForProfile, resolveFrame, withFormat } from '../src';

describe('resolveFrame', () => {
  const print = defaultPrintSettings('A4'); // inner 18, outer 14, top 14, bottom 17

  it('mirrors inner and outer margins between left and right pages', () => {
    const right = resolveFrame('A4', print, 'right');
    const left = resolveFrame('A4', print, 'left');
    expect(right.bindingEdge).toBe('left');
    expect(right.margins).toEqual({ left: 18, right: 14, top: 14, bottom: 17 });
    expect(left.bindingEdge).toBe('right');
    expect(left.margins).toEqual({ left: 14, right: 18, top: 14, bottom: 17 });
    expect(right.content).toEqual({ x: 18, y: 14, w: 178, h: 266 });
    expect(left.content).toEqual({ x: 14, y: 14, w: 178, h: 266 });
  });

  it.each(['A4', 'A5'] as const)('uses the true %s trim size', (format) => {
    const frame = resolveFrame(format, defaultPrintSettings(format), 'right');
    expect(frame.trim).toEqual({ w: PAGE_FORMATS[format].width, h: PAGE_FORMATS[format].height });
  });

  it('places ring holes on the binding edge of each side', () => {
    const right = resolveFrame('A4', print, 'right');
    const left = resolveFrame('A4', print, 'left');
    expect(right.holes).toEqual([
      { cx: 12, cy: 108.5, d: 6 },
      { cx: 12, cy: 188.5, d: 6 },
    ]);
    expect(left.holes.map((h) => h.cx)).toEqual([198, 198]);
    expect(right.bindingZone).toEqual({ x: 0, y: 0, w: 18, h: 297 });
    expect(left.bindingZone).toEqual({ x: 192, y: 0, w: 18, h: 297 });
  });

  it('keeps content clear of punched holes and the printer edge, with warnings', () => {
    expect(minimumInnerMargin(print)).toBe(18); // 12 + 6/2 + 3 clearance
    const tight = { ...print, margins: { inner: 10, outer: 2, top: 14, bottom: 17 } };
    const frame = resolveFrame('A4', tight, 'right');
    expect(frame.margins.left).toBe(18);
    expect(frame.margins.right).toBe(5);
    expect(frame.warnings.map((w) => [w.code, w.margin, w.appliedMm])).toEqual([
      ['inner-margin-in-hole-zone', 'inner', 18],
      ['margin-below-printer-safe', 'outer', 5],
    ]);
  });

  it('puts the outer rail on the outer edge of each side', () => {
    const withRail = { ...print, outerRail: 30 };
    const right = resolveFrame('A4', withRail, 'right');
    const left = resolveFrame('A4', withRail, 'left');
    expect(right.outerRail).toEqual({ x: 166, y: 14, w: 30, h: 266 });
    expect(right.body).toEqual({ x: 18, y: 14, w: 144, h: 266 });
    expect(left.outerRail).toEqual({ x: 14, y: 14, w: 30, h: 266 });
    expect(left.body).toEqual({ x: 48, y: 14, w: 144, h: 266 });
    expect(resolveFrame('A4', print, 'right').outerRail).toBeUndefined();
    expect(resolveFrame('A4', print, 'right', 30).outerRail).toEqual(right.outerRail);
  });
});

describe('withFormat', () => {
  const project = createProject({
    id: 'p',
    name: 'P',
    format: 'A4',
    locale: 'pl',
    now: '2026-01-01T00:00:00.000Z',
  });

  it('switches format, home profile, default margins and hole positions', () => {
    const a5 = withFormat(project, 'A5');
    expect(a5.format).toBe('A5');
    expect(a5.generation.format).toBe('A5');
    expect(a5.print.profile).toBe('home-a5-2up');
    expect(a5.print.binding.kind === 'ring' && a5.print.binding.holePositions).toEqual([65, 145]);
    expect(a5.print.margins).toEqual({ inner: 18, outer: 11, top: 11, bottom: 13 });
    expect(withFormat(a5, 'A4').print).toEqual(project.print);
  });

  it('keeps customised margins when switching format', () => {
    const custom = {
      ...project,
      print: { ...project.print, margins: { inner: 20, outer: 12, top: 12, bottom: 15 } },
    };
    expect(withFormat(custom, 'A5').print.margins).toEqual(custom.print.margins);
  });

  it('pads duplex to 2 and 2-up A5 to 4', () => {
    expect(padToForProfile('home-duplex')).toBe(2);
    expect(padToForProfile('home-a5-2up')).toBe(4);
  });
});
