import { createDefaultRegistry, haltVariables } from '@planner/blocks';
import type { PageFrame, PatchWarning, PhysicalPage } from '@planner/core';
import type { PageLabel } from '@planner/core';
import {
  conditionConfig,
  listBlocks,
  padToForProfile,
  pageLabels,
  paginate,
  resolveFrame,
  resolvePageTemplate,
} from '@planner/core';
import { pageVariables, plannerEndDate } from '@planner/i18n';
import type {
  Condition,
  ContentItem,
  PageTemplate,
  PatternSpec,
  PlannerProject,
} from '@planner/schema';
import { withNumbering } from './templates';

/** All built-in block types; the renderer calls this for every block on every page. */
export const blockRegistry = createDefaultRegistry();

export interface RenderedPage {
  page: PhysicalPage;
  frame: PageFrame;
  /** The page template as it prints here: format, side and the page's own changes applied. */
  template?: PageTemplate;
  /** Blocks left out on this page (hidden on the page or by a visibility rule). */
  hidden: string[];
  /** Printed page number: "iv", "12", "S1" (the physical position is `page.number`). */
  label: PageLabel;
  vars: Record<string, string>;
  contentFor: (blockId: string) => ContentItem | undefined;
}

/** A rule that reads the page or its variables differs per page; module and format rules do not. */
const perPage = (c: Condition | undefined) =>
  c !== undefined && /"(page|vars)[."]/.test(JSON.stringify(c));

/** Filler pages print as the notes page: a 5 mm dot grid (§8.4). */
export const FILLER_PATTERN: PatternSpec = { kind: 'dots', pitch: 5, ink: 0.45 };

/**
 * Paginates a project and prepares every page for rendering: physical frame, format-adjusted
 * template, page variables and assigned content.
 */
export function layoutProject(input: PlannerProject) {
  const project = withNumbering(input);
  const templates = project.template.pageTemplates;
  const { pages, warnings } = paginate(project.document.root, {
    templates,
    padTo: padToForProfile(project.print.profile),
  });
  const labels = pageLabels(pages, project.document.root, templates);
  const haltVars = haltVariables(templates, project.locale);
  // Modules resolved to on/off (ADR-0010), for every visibility rule and variant.
  const config = conditionConfig(project.template, project.generation);

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
        listBlocks(source).some(
          (e) => perPage(e.block.visibility) || e.block.variants?.some((v) => perPage(v.when)),
        ),
      );
    }
    const personal = Object.keys(instance.overrides ?? {}).length > 0 || hasRules.get(source.id);
    const options = {
      format: project.format,
      side: page.side,
      overrides: instance.overrides,
      scope: {
        page: { side: page.side, number: page.number, ...instance.context },
        config,
        format: project.format,
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

  const rendered: RenderedPage[] = pages.map((page, i) => {
    const instance = page.instance;
    const vars = {
      ...haltVars,
      ...pageVariables(project, instance?.context ?? {}, project.locale),
    };
    const resolved = resolveFor(page, vars);
    const template = resolved?.template;
    const assignments = instance?.contentAssignments ?? {};
    return {
      page,
      template,
      hidden: resolved?.hidden ?? [],
      label: labels[i]!,
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

/** A page's printed number for screens: "iv", "12", "S1", or "–" for unnumbered pages. */
export const shownLabel = (p: RenderedPage) => p.label.text || '–';

/**
 * The page a typed number means: its printed label first ("iv", "S1", "12"), else its position
 * in the file ("5" when no page is labelled 5).
 */
export function findPage(pages: readonly RenderedPage[], typed: string): number {
  const wanted = typed.trim().toLowerCase();
  if (!wanted) return -1;
  const byLabel = pages.findIndex((p) => p.label.text.toLowerCase() === wanted);
  if (byLabel >= 0) return byLabel;
  const n = Number(wanted);
  return Number.isInteger(n) && n >= 1 && n <= pages.length ? n - 1 : -1;
}
