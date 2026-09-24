'use client';

import type { toSpreads } from '@planner/core';
import type { BlockRef } from '@planner/editor';
import type { PlannerProject } from '@planner/schema';
import { createContext, useContext } from 'react';
import type { Selection } from '@/lib/editorStore';
import type { RenderedPage, layoutProject } from '@/lib/pages';

export type ProjectLayout = ReturnType<typeof layoutProject> & {
  spreads: ReturnType<typeof toSpreads>;
};

export const LayoutContext = createContext<ProjectLayout | null>(null);

export function useLayout(): ProjectLayout {
  const layout = useContext(LayoutContext);
  if (!layout) throw new Error('useLayout outside the designer');
  return layout;
}

/** Index of the page the selection points at; follows the page key across regenerations. */
export function currentPageIndex(layout: ProjectLayout, selection: Selection): number {
  if (selection.pageKey) {
    const byKey = layout.pages.findIndex((p) => p.page.instance?.key === selection.pageKey);
    if (byKey >= 0) return byKey;
  }
  return Math.max(0, Math.min(layout.pages.length - 1, selection.pageIndex));
}

export interface SelectedBlock {
  page: RenderedPage;
  ref: BlockRef;
}

/** The selected block with its page, when the block exists on that page's template. */
export function selectedBlock(
  project: PlannerProject,
  layout: ProjectLayout,
  selection: Selection,
): SelectedBlock | undefined {
  const page = layout.pages[currentPageIndex(layout, selection)];
  const instance = page?.page.instance;
  if (!page || !instance || !selection.blockId) return undefined;
  if (!project.template.pageTemplates[instance.templateId]) return undefined;
  return { page, ref: { templateId: instance.templateId, blockId: selection.blockId } };
}
