import type { PageFrame, PhysicalPage } from '@planner/core';
import { padToForProfile, paginate, resolveFrame } from '@planner/core';
import type { PageTemplate, PatternSpec, PlannerProject } from '@planner/schema';

export interface RenderedPage {
  page: PhysicalPage;
  frame: PageFrame;
  template?: PageTemplate;
}

/** Filler pages print as the notes page: a 5 mm dot grid (§8.4). */
export const FILLER_PATTERN: PatternSpec = { kind: 'dots', pitch: 5, ink: 0.45 };

/** Paginates a project and resolves each page's physical frame. */
export function layoutProject(project: PlannerProject) {
  const templates = project.template.pageTemplates;
  const { pages, warnings } = paginate(project.document.root, {
    templates,
    padTo: padToForProfile(project.print.profile),
  });
  const rendered: RenderedPage[] = pages.map((page) => {
    const template = page.instance ? templates[page.instance.templateId] : undefined;
    return {
      page,
      template,
      frame: resolveFrame(project.format, project.print, page.side, template?.outerRailWidth),
    };
  });
  const frameWarnings = rendered[0]?.frame.warnings ?? [];
  return { pages: rendered, paginationWarnings: warnings, frameWarnings };
}
