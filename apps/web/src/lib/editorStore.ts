'use client';

import type { History } from '@planner/editor';
import { emptyHistory, record, redo, undo } from '@planner/editor';
import type { PlannerProject } from '@planner/schema';
import { create } from 'zustand';

export type EditScopeKind = 'template' | 'page';
export type LeftTab = 'pages' | 'layers' | 'components' | 'templates' | 'content' | 'variables';
export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export interface Selection {
  /** Physical page shown on the canvas (its spread is shown in spread view). */
  pageIndex: number;
  /** Page instance key, so the selection survives regeneration moving page numbers. */
  pageKey?: string;
  blockId?: string;
}

interface EditorState {
  project: PlannerProject | null;
  history: History<PlannerProject>;
  save: SaveState;
  /** Label of the last change, undo or redo, announced to screen readers. */
  status?: string;

  selection: Selection;
  scope: EditScopeKind;
  /** Canvas zoom; 'fit' scales the spread to the available width. */
  zoom: number | 'fit';
  view: 'spread' | 'single';
  guides: boolean;
  grid: boolean;
  /** Resize snapping in mm. */
  snap: 1 | 5;
  tab: LeftTab;

  load: (project: PlannerProject) => void;
  /** Runs a document command; one undo step per call (or per merge key within a moment). */
  apply: (label: string, fn: (p: PlannerProject) => PlannerProject, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (state: SaveState, project?: PlannerProject) => void;
  select: (selection: Partial<Selection>) => void;
  set: (
    patch: Partial<
      Pick<EditorState, 'scope' | 'zoom' | 'view' | 'guides' | 'grid' | 'snap' | 'tab'>
    >,
  ) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  history: emptyHistory(),
  save: 'saved',
  selection: { pageIndex: 0 },
  scope: 'template',
  zoom: 'fit',
  view: 'spread',
  guides: true,
  grid: false,
  snap: 1,
  tab: 'pages',

  load: (project) =>
    set({
      project,
      history: emptyHistory(),
      save: 'saved',
      status: undefined,
      selection: { pageIndex: 0 },
    }),

  apply: (label, fn, mergeKey) => {
    const { project, history } = get();
    if (!project) return;
    const next = fn(project);
    if (next === project) return;
    set({
      project: next,
      history: record(history, project, label, { mergeKey }),
      save: 'unsaved',
      status: label,
    });
  },

  undo: () => {
    const { project, history } = get();
    const step = project && undo(history, project);
    if (step)
      set({ project: step.value, history: step.history, save: 'unsaved', status: step.label });
  },

  redo: () => {
    const { project, history } = get();
    const step = project && redo(history, project);
    if (step)
      set({ project: step.value, history: step.history, save: 'unsaved', status: step.label });
  },

  markSaved: (state, snapshot) => {
    // A save that finished after further edits leaves the newer edits unsaved.
    if (state === 'saved' && snapshot && get().project !== snapshot) return;
    set({ save: state });
  },

  select: (selection) => set((s) => ({ selection: { ...s.selection, ...selection } })),
  set: (patch) => set(patch),
}));
