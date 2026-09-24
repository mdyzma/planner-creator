import type { OutputFile } from '@planner/pdf';
import { assemble, mergePdfs, planExport } from '@planner/pdf';
import type { PlannerProject, PrintProfile } from '@planner/schema';
import { PAGE_FORMATS } from '@planner/schema';
import type { Renderer } from './render';

export interface ExportOptions {
  profile?: PrintProfile;
  /** Top-level section key to print on its own, e.g. `month:2026-11`. */
  section?: string;
  reverseBacks?: boolean;
  date?: Date;
  onProgress?: (done: number, total: number) => void;
}

/**
 * The whole export in one process (CLI and tests). The web app runs the same steps, with the
 * rendering done by this service over HTTP and merging and imposition done in the browser.
 */
export async function exportPlanner(
  renderer: Renderer,
  project: PlannerProject,
  options: ExportOptions = {},
): Promise<OutputFile[]> {
  const profile = options.profile ?? project.print.profile;
  const plan = planExport(project, { profile, section: options.section });
  let done = 0;
  const parts = await Promise.all(
    plan.parts.map(async (part) => {
      const bytes = await renderer.render({ project, ...part });
      options.onProgress?.(++done, plan.parts.length);
      return bytes;
    }),
  );
  const { width, height } = PAGE_FORMATS[project.format];
  const bleed = project.print.bleed;
  const merged = await mergePdfs(parts, {
    pageSize: { width: width + 2 * bleed, height: height + 2 * bleed },
  });
  return assemble(merged, {
    profile,
    title: project.meta.name,
    bleedMm: project.print.bleed,
    reverseBacks: options.reverseBacks,
    date: options.date,
  });
}
