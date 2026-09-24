import { resolveFrame } from '@planner/core';
import type { PageTemplate } from '@planner/schema';
import { defaultPrintSettings } from '@planner/schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageView, PrintDocument, flexFor, inkColor } from '../src';

const template: PageTemplate = {
  id: 'daily',
  name: { en: 'Daily' },
  background: { kind: 'dots', pitch: 5, ink: 0.45 },
  body: {
    kind: 'stack',
    gap: 4,
    label: { en: 'Morning', pl: 'Poranek' },
    children: [
      {
        kind: 'block',
        block: { id: 'pledge', type: 'text', props: null, size: { height: { mm: 20 } } },
      },
      {
        kind: 'block',
        block: { id: 'notes', type: 'writing-area', props: null, size: { height: { fr: 1 } } },
      },
    ],
  },
};

const render = (side: 'left' | 'right', mode: 'edit' | 'print', format: 'A4' | 'A5' = 'A4') =>
  renderToStaticMarkup(
    <PageView
      frame={resolveFrame(format, defaultPrintSettings(format), side)}
      template={template}
      locale="pl"
      mode={mode}
      pageNumber={7}
    />,
  );

describe('PageView', () => {
  it.each([
    ['A4', '210mm', '297mm'],
    ['A5', '148mm', '210mm'],
  ] as const)('renders %s at true size in mm', (format, w, h) => {
    const html = render('right', 'print', format);
    expect(html).toContain(`width:${w};height:${h}`);
  });

  it('mirrors the body between left and right pages', () => {
    expect(render('right', 'print')).toContain('left:18mm;top:14mm;width:178mm;height:266mm');
    expect(render('left', 'print')).toContain('left:14mm;top:14mm;width:178mm;height:266mm');
  });

  it('shows guides when editing and never in print', () => {
    expect(render('right', 'edit')).toContain('data-guide="binding"');
    expect(render('right', 'edit').match(/data-guide="hole"/g)).toHaveLength(2);
    expect(render('right', 'print')).not.toContain('data-guides');
  });

  it('draws the dot grid as vector SVG and uses the page locale for labels', () => {
    const html = render('right', 'print');
    expect(html).toContain('data-pattern="dots"');
    expect(html).toContain('<circle cx="2.5" cy="2.5" r="0.25"');
    expect(html).toContain('Poranek');
  });

  it('puts the page number in the outer corner', () => {
    expect(render('right', 'print')).toMatch(/data-page-number="true" style="[^"]*right:14mm/);
    expect(render('left', 'print')).toMatch(/data-page-number="true" style="[^"]*left:14mm/);
  });

  it('sizes the print sheet with @page', () => {
    const html = renderToStaticMarkup(
      <PrintDocument width={148} height={210}>
        x
      </PrintDocument>,
    );
    expect(html).toContain('@page { size: 148mm 210mm; margin: 0; }');
  });
});

describe('units', () => {
  it('maps lengths to flex sizing', () => {
    expect(flexFor({ mm: 20 })).toEqual({ flex: '0 0 20mm' });
    expect(flexFor({ fr: 2 })).toEqual({ flex: '2 1 0' });
    expect(flexFor('auto')).toEqual({ flex: '0 0 auto' });
    expect(flexFor(undefined)).toEqual({ flex: '1 1 0' });
  });

  it('maps ink values to greys', () => {
    expect(inkColor(1)).toBe('rgb(0, 0, 0)');
    expect(inkColor(0)).toBe('rgb(255, 255, 255)');
  });
});
