import type { PlannerProject } from '@planner/schema';

/**
 * What the export service hands the print route (§8.3): the project and the printed pages to
 * render. The route renders pages `from`…`to` (0-based, inclusive) and then `padAfter` blank
 * notes pages, e.g. to make a single month a multiple of four pages for 2-up printing.
 */
export interface ExportPayload {
  project: PlannerProject;
  from: number;
  to: number;
  padAfter: number;
}

declare global {
  interface Window {
    /** Set by the export service before the page loads; absent in normal use. */
    __PLANNER_EXPORT__?: ExportPayload;
  }
}

export const exportPayload = (): ExportPayload | undefined =>
  typeof window === 'undefined' ? undefined : window.__PLANNER_EXPORT__;

/** The print route sets this attribute on <html> once fonts are loaded and pages are laid out. */
export const EXPORT_READY_ATTRIBUTE = 'data-export-ready';
