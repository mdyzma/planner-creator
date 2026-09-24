# ADR-0004: PDF export via headless Chromium behind an `Exporter` adapter

Status: Proposed · Date: 2026-09-24

## Context
Output must be vector, true physical size, with embedded fonts, bleed and crop marks, for ~500 pages (default planner: 474).
The editor renders with React DOM in mm.

## Decision
`apps/export-worker` (Node + Playwright) loads a headless `/print` route built from
`planner-renderer`, injects the project JSON, and calls `page.pdf({ preferCSSPageSize: true })`.
`@page` size = trim + 2·bleed (+ slug for crop marks). `pdf-lib` post-processing sets TrimBox/BleedBox.
Grayscale is a token swap, not a CSS filter. A `pdf-browser-print` adapter (`window.print()`) is the
offline fallback. All exporters implement `Exporter.export(project, opts) → Blob`.

## Alternatives
- **@react-pdf/renderer / pdf-lib drawing** — client-side, no server; but a second renderer means
  editor and PDF drift apart (no WYSIWYG). Rejected for MVP.
- **Paged.js in the browser** — good print CSS polyfill, still ends at the browser print dialog.
- **Commercial (PrinceXML, PDFreactor)** — best print CSS & PDF/X support; licence cost. Keep as a
  future adapter if CMYK/PDF/X becomes mandatory.

## Consequences
+ One renderer; vector text and SVG patterns; exact page boxes.
− A server-side component (container with Chromium, ~400 MB image); not serverless-friendly.
− RGB only; CMYK/PDF/X would need a Ghostscript step.
− Project JSON transits the worker; worker must be stateless and not log payloads.

## Amendment (2026-09-24)
Planners are printed on the user's own hardware (ADR-0006), so the RGB-only / no-PDF/X limitation is
accepted without a Ghostscript step. Imposition and ViewerPreferences are added as `pdf-lib`
post-processing in the same worker. Deployment modes are covered in ADR-0007.
