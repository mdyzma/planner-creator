import { findBlock } from '@planner/core';
import type { PageInstance, PlannerProject, SectionNode } from '@planner/schema';
import { isPageInstance } from '@planner/schema';
import type { BlockRef } from './commands';

/** Where a block's value comes from, lowest to highest precedence (§4.4). */
export type ValueOrigin = 'default' | 'template' | 'format' | 'page';

const hasKey = (obj: unknown, key: string) =>
  typeof obj === 'object' && obj !== null && !Array.isArray(obj) && key in obj;

/**
 * Which level sets a block's property (`props`), style value (`style`) or size (`size`) on a page:
 * the page's own change, the format adjustment (e.g. A5), the template, or the block default.
 */
export function valueOrigin(
  project: PlannerProject,
  ref: BlockRef,
  group: 'props' | 'style' | 'size',
  key: string,
  page?: PageInstance,
): ValueOrigin {
  if (group !== 'size' && hasKey(page?.overrides?.[ref.blockId]?.[group], key)) return 'page';
  const template = project.template.pageTemplates[ref.templateId];
  const entry = template && findBlock(template, ref.blockId);
  if (!entry) return 'default';
  const path = `${entry.pointer}/${group}/${key}`;
  if (template.formatOverrides?.[project.format]?.some((op) => op.path === path)) return 'format';
  return hasKey(entry.block[group], key) ? 'template' : 'default';
}

/** Number of switched-on pages per page template, e.g. `{ 'day-left': 182 }`. */
export function templateUsage(project: PlannerProject): Record<string, number> {
  const usage: Record<string, number> = {};
  const visit = (node: SectionNode) => {
    if (!node.enabled) return;
    for (const child of node.children) {
      if (isPageInstance(child)) {
        if (child.enabled) usage[child.templateId] = (usage[child.templateId] ?? 0) + 1;
      } else visit(child);
    }
  };
  visit(project.document.root);
  return usage;
}

/** Finds a page instance by key. */
export function findPage(project: PlannerProject, key: string): PageInstance | undefined {
  const visit = (node: SectionNode): PageInstance | undefined => {
    for (const child of node.children) {
      const found = isPageInstance(child) ? (child.key === key ? child : undefined) : visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(project.document.root);
}
