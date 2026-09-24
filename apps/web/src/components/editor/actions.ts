'use client';

import { findBlock } from '@planner/core';
import type { NewBlock } from '@planner/editor';
import {
  addBlock,
  deleteBlock,
  duplicateBlock,
  moveBlock,
  setBlockHiddenOnPage,
} from '@planner/editor';
import { useEditor } from '@/lib/editorStore';
import type { ProjectLayout } from './context';
import { currentPageIndex, selectedBlock } from './context';

/**
 * Designer actions shared by the toolbar, keyboard shortcuts, layers and the inspector. Labels
 * are the undo-step names announced after a change.
 */
export interface ActionLabels {
  add: string;
  duplicate: string;
  delete: string;
  hide: string;
  move: string;
}

const state = () => useEditor.getState();

function current(layout: ProjectLayout) {
  const { project, selection } = state();
  if (!project) return undefined;
  const selected = selectedBlock(project, layout, selection);
  return selected && { project, ...selected };
}

/** Adds a block to page `pageIndex`: after the selected block when it is on that page. */
export function addBlockToPage(
  layout: ProjectLayout,
  pageIndex: number,
  block: NewBlock,
  label: string,
  after?: string,
) {
  const { project, selection } = state();
  const page = layout.pages[pageIndex];
  const instance = page?.page.instance;
  if (!project || !instance || !project.template.pageTemplates[instance.templateId]) return;
  const sameTemplate =
    layout.pages[currentPageIndex(layout, selection)]?.page.instance?.templateId ===
    instance.templateId;
  const anchor = after ?? (sameTemplate ? selection.blockId : undefined);
  let added = '';
  state().apply(label, (p) => {
    const result = addBlock(p, instance.templateId, block, anchor);
    added = result.blockId;
    return result.project;
  });
  if (added) state().select({ pageIndex, pageKey: instance.key, blockId: added });
}

export function duplicateSelected(layout: ProjectLayout, label: string) {
  const sel = current(layout);
  if (!sel) return;
  let added = '';
  state().apply(label, (p) => {
    const result = duplicateBlock(p, sel.ref);
    added = result.blockId;
    return result.project;
  });
  if (added) state().select({ blockId: added });
}

/** Deletes the block from the template, or hides it on this page in page scope. */
export function removeSelected(
  layout: ProjectLayout,
  labels: Pick<ActionLabels, 'delete' | 'hide'>,
) {
  const sel = current(layout);
  const { scope } = state();
  if (!sel) return;
  const pageKey = sel.page.page.instance?.key;
  if (scope === 'page' && pageKey) {
    state().apply(labels.hide, (p) => setBlockHiddenOnPage(p, pageKey, sel.ref.blockId, true));
  } else {
    state().apply(labels.delete, (p) => deleteBlock(p, sel.ref));
  }
  state().select({ blockId: undefined });
}

/** Moves the selected block one place earlier (−1) or later (+1) among its siblings. */
export function nudgeSelected(layout: ProjectLayout, delta: -1 | 1, label: string) {
  const sel = current(layout);
  if (!sel) return;
  const template = sel.project.template.pageTemplates[sel.ref.templateId];
  const entry = template && findBlock(template, sel.ref.blockId);
  if (!entry) return;
  state().apply(label, (p) => moveBlock(p, sel.ref, entry.index + delta));
}

/** Shows the previous or next spread (or page in single view). */
export function turnPage(layout: ProjectLayout, delta: -1 | 1) {
  const { selection, view } = state();
  const index = currentPageIndex(layout, selection);
  let next = index + delta;
  if (view === 'spread') {
    const spread = layout.spreads.findIndex(
      (s) => s.left?.index === index || s.right?.index === index,
    );
    const target = layout.spreads[spread + delta];
    if (!target) return;
    next = (target.left ?? target.right)!.index;
  }
  if (next < 0 || next >= layout.pages.length) return;
  state().select({
    pageIndex: next,
    pageKey: layout.pages[next]?.page.instance?.key,
    blockId: undefined,
  });
}
