import { createDefaultRegistry } from '@planner/blocks';
import type { PageFrame, PatchWarning, PhysicalPage } from '@planner/core';
import {
  listBlocks,
  padToForProfile,
  paginate,
  resolveFrame,
  resolvePageTemplate,
} from '@planner/core';
import { pageVariables, plannerEndDate } from '@planner/i18n';
import type { ContentItem, PageTemplate, PatternSpec, PlannerProject } from '@planner/schema';

/** All built-in block types; the renderer calls this for every block on every page. */
export const blockRegistry = createDefaultRegistry();

export interface RenderedPage {
  page: PhysicalPage;
  frame: PageFrame;
  /** The page template as it prints here: format, side and the page's own changes applied. */
  template?: PageTemplate;
  /** Blocks left out on this page (hidden on the page or by a visibility rule). */
  hidden: string[];
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

  // Pages without their own changes share one resolved template per template and side.
  const shared = new Map<string, ReturnType<typeof resolvePageTemplate>>();
  const hasRules = new Map<string, boolean>();
  const formatWarnings: PatchWarning[] = [];
  const resolveFor = (page: PhysicalPage, vars: Record<string, string>) => {
    const instance = page.instance;
    const source = instance ? templates[instance.templateId] : undefined;
    if (!instance || !source) return undefined;
    if (!hasRules.has(source.id)) {
      hasRules.set(
        source.id,
        listBlocks(source).some((e) => e.block.visibility),
      );
    }
    const personal = Object.keys(instance.overrides ?? {}).length > 0 || hasRules.get(source.id);
    const options = {
      format: project.format,
      side: page.side,
      overrides: instance.overrides,
      scope: {
        page: { side: page.side, number: page.number, ...instance.context },
        config: project.generation,
        vars,
      },
    };
    if (personal) return resolvePageTemplate(source, options);
    const key = `${source.id}|${page.side}`;
    if (!shared.has(key)) {
      const result = resolvePageTemplate(source, options);
      formatWarnings.push(...result.warnings);
      shared.set(key, result);
    }
    return shared.get(key)!;
  };

  const rendered: RenderedPage[] = pages.map((page) => {
    const instance = page.instance;
    const vars = pageVariables(project, instance?.context ?? {}, project.locale);
    const resolved = resolveFor(page, vars);
    const template = resolved?.template;
    const assignments = instance?.contentAssignments ?? {};
    return {
      page,
      template,
      hidden: resolved?.hidden ?? [],
      frame: resolveFrame(project.format, project.print, page.side, template?.outerRailWidth),
      vars,
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
    formatWarnings,
  };
}
