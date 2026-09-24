import type { ReactNode } from 'react';
import { mm } from './units';

/**
 * Wraps pages for printing. `@page` fixes the sheet size to trim + bleed with no margins, and
 * every page breaks after itself, so browser print and headless Chromium produce true-size pages.
 */
export function PrintDocument({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const css = `
@page { size: ${mm(width)} ${mm(height)}; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: none !important; }
  .planner-print-page { break-after: page; }
  .planner-print-page:last-child { break-after: auto; }
}`;
  return (
    <div data-print-document>
      <style>{css}</style>
      {children}
    </div>
  );
}

/** Two facing pages with the binding between them, as the open book looks. */
export function SpreadView({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div data-spread style={{ display: 'flex', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>{left}</div>
      <div
        aria-hidden="true"
        style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(0,0,0,0.25)' }}
      />
      <div style={{ display: 'flex', minWidth: 0 }}>{right}</div>
    </div>
  );
}
