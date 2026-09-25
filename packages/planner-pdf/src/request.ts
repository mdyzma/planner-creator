import type { PlannerProject } from '@planner/schema';
import { parseProject } from '@planner/schema';

/**
 * The export services' one endpoint (§8.3), shared by the local service (apps/export-node) and
 * the Cloudflare Worker (apps/worker): render printed pages `from`…`to` (0-based) of `project`,
 * then `padAfter` blank notes pages.
 */
export interface RenderRequest {
  project: PlannerProject;
  from: number;
  to: number;
  padAfter: number;
  /** Example mode: print the template's grey handwritten examples and notes. */
  samples?: boolean;
}

/** A part never needs more than three pads (to reach a multiple of four pages for 2-up). */
export const MAX_PAD_AFTER = 3;

export type RenderRequestResult =
  | { ok: true; request: RenderRequest }
  | {
      ok: false;
      error: 'invalid project' | 'invalid page range' | 'invalid options';
      issues?: unknown[];
    };

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Validates an untrusted request body: the project against the schema, and the page range. */
export function parseRenderRequest(body: unknown): RenderRequestResult {
  const { project, from, to, padAfter, samples } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Record<string, unknown>;
  const parsed = parseProject(project);
  if (!parsed.ok) return { ok: false, error: 'invalid project', issues: parsed.issues.slice(0, 5) };
  if (!isInt(from) || !isInt(to) || to < from || !isInt(padAfter) || padAfter > MAX_PAD_AFTER) {
    return { ok: false, error: 'invalid page range' };
  }
  if (samples !== undefined && typeof samples !== 'boolean') {
    return { ok: false, error: 'invalid options' };
  }
  return {
    ok: true,
    request: { project: parsed.value, from, to, padAfter, ...(samples ? { samples: true } : {}) },
  };
}

/** The print route that renders a request, relative to the site root. */
export const printRoute = (request: RenderRequest) => `/${request.project.locale}/print`;

/** Attribute the print route sets on <html> when the pages are ready to print. */
export const EXPORT_READY_SELECTOR = 'html[data-export-ready="true"]';
