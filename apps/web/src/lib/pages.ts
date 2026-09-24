import { createDefaultRegistry } from '@planner/blocks';
import type { PageFrame, PatchWarning, PhysicalPage } from '@planner/core';
import { padToForProfile, paginate, resolveFrame, resolveTemplateForFormat } from '@planner/core';
import { pageVariables, plannerEndDate } from '@planner/i18n';
import type { ContentItem, PageTemplate, PatternSpec, PlannerProject } from '@planner/schema';

/** All built-in block types; the renderer calls this for every block on every page. */
export const blockRegistry = createDefaultRegistry();

export interface RenderedPage {
  page: PhysicalPage;
  frame: PageFrame;
  /** The page template with its per-format adjustments applied. */
  template?: PageTemplate;
  vars: Record<string, string>;
  contentFor: (blockId: string) => ContentItem | undefined;
}

/** Filler pages print as the notes page: a 5 mm dot grid (§8.4). */
export const FILLER_PATTERN: PatternSpec = { kind: 'dots', pitch: 5, ink: 0.45 };

/**
 * Paginates a project and prepares every page for rendering: physical frame, format-adjusted
 * template, page variables and assigned content.
 */
export function layoutProject(project: PlannerProject) {
  const templates = project.template.pageTemplates;
  const { pages, warnings } = paginate(project.document.root, {
    templates,
    padTo: padToForProfile(project.print.profile),
  });

  const items = new Map<string, ContentItem>();
  for (const library of project.content) for (const item of library.items) items.set(item.id, item);

  const resolved = new Map<string, { template: PageTemplate; warnings: PatchWarning[] }>();
  const templateFor = (id: string) => {
    const source = templates[id];
    if (!source) return undefined;
    if (!resolved.has(id)) resolved.set(id, resolveTemplateForFormat(source, project.format));
    return resolved.get(id)!.template;
  };

  const rendered: RenderedPage[] = pages.map((page) => {
    const instance = page.instance;
    const template = instance ? templateFor(instance.templateId) : undefined;
    const assignments = instance?.contentAssignments ?? {};
    return {
      page,
      template,
      frame: resolveFrame(project.format, project.print, page.side, template?.outerRailWidth),
      vars: pageVariables(project, instance?.context ?? {}, project.locale),
      contentFor: (blockId) => {
        const id = assignments[blockId];
        return id ? items.get(id) : undefined;
      },
    };
  });

  const start = project.generation.startDate;
  const end = plannerEndDate(project);
  return {
    pages: rendered,
    range: start && end ? { start, end } : undefined,
    paginationWarnings: warnings,
    frameWarnings: rendered[0]?.frame.warnings ?? [],
    formatWarnings: [...resolved.values()].flatMap((r) => r.warnings),
  };
}
