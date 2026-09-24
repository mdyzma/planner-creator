import type { PageInstance, PlannerProject, SectionNode } from '@planner/schema';
import { isPageInstance } from '@planner/schema';
import type { GenerateResult } from './generate';
import { generate, pageBudget } from './generate';

export interface RegenerateResult extends GenerateResult {
  project: PlannerProject;
  /** Keys of edited or disabled pages that no longer exist after regenerating. */
  orphans: string[];
}

function collect(
  node: SectionNode,
  sections: Map<string, SectionNode>,
  pages: Map<string, PageInstance>,
) {
  sections.set(node.key, node);
  for (const child of node.children) {
    if (isPageInstance(child)) pages.set(child.key, child);
    else collect(child, sections, pages);
  }
}

/** A page carries user work if it was edited, disabled, or added by hand. */
const hasUserWork = (p: PageInstance) =>
  p.enabled === false || p.origin === 'manual' || Object.keys(p.overrides ?? {}).length > 0;

/**
 * Regenerates a project's pages from its template and generation settings, keeping the user's
 * work (ADR-0003): pages and sections are matched by their stable keys, and each match keeps its
 * overrides, on/off state and content assignments. Work that no longer has a place is reported.
 */
export function regenerate(project: PlannerProject): RegenerateResult {
  const result = generate({
    template: project.template,
    config: project.generation,
    content: project.content,
    seed: project.id,
    profile: project.print.profile,
  });

  const oldSections = new Map<string, SectionNode>();
  const oldPages = new Map<string, PageInstance>();
  collect(project.document.root, oldSections, oldPages);
  const kept = new Set<string>();

  const merge = (node: SectionNode): SectionNode => ({
    ...node,
    enabled: oldSections.get(node.key)?.enabled ?? node.enabled,
    children: node.children.map((child) => {
      if (!isPageInstance(child)) return merge(child);
      const old = oldPages.get(child.key);
      if (!old) return child;
      kept.add(child.key);
      return {
        ...child,
        enabled: old.enabled,
        ...(old.overrides ? { overrides: old.overrides } : {}),
        // Keep the content that was already on the page; a later "re-deal" can reshuffle.
        ...(old.contentAssignments ? { contentAssignments: old.contentAssignments } : {}),
      };
    }),
  });

  const root = merge(result.document.root);
  const orphans = [...oldPages.values()]
    .filter((p) => !kept.has(p.key) && hasUserWork(p))
    .map((p) => p.key);
  return {
    ...result,
    document: { root },
    // Recount: pages the user turned off change the total.
    budget: pageBudget({ root }, project.template, project.print.profile),
    project: { ...project, document: { root } },
    orphans,
  };
}
