'use client';

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toSpreads } from '@planner/core';
import type { NewBlock, RecipePath } from '@planner/editor';
import { moveBlock, moveRecipeChild } from '@planner/editor';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ProjectStatus } from '@/components/ProjectStatus';
import { useEditor } from '@/lib/editorStore';
import { layoutProject } from '@/lib/pages';
import { getProjectRepository } from '@/lib/repository';
import { useProject } from '@/lib/useProject';
import {
  addBlockToPage,
  duplicateSelected,
  nudgeSelected,
  removeSelected,
  turnPage,
} from './actions';
import { Canvas } from './Canvas';
import type { ProjectLayout } from './context';
import { LayoutContext, currentPageIndex } from './context';
import { Inspector } from './Inspector';
import { LeftPanel } from './LeftPanel';
import { Toolbar } from './Toolbar';

/** Data attached to draggable things, read when a drag ends. */
export type DragData =
  | { kind: 'palette'; block: NewBlock; label: string }
  | { kind: 'layer'; blockId: string; container: string; index: number }
  | { kind: 'recipe'; path: RecipePath; index: number }
  | { kind: 'page'; pageIndex: number };

export function EditorScreen() {
  const id = useSearchParams().get('id');
  const { state } = useProject(id);
  const load = useEditor((s) => s.load);
  const project = useEditor((s) => s.project);

  useEffect(() => {
    if (state.status === 'ready') load(state.project);
  }, [state, load]);

  if (state.status !== 'ready' || !project || project.id !== id) {
    return (
      <ProjectStatus
        status={state.status === 'ready' ? 'loading' : state.status}
        message={state.status === 'error' ? state.message : undefined}
      />
    );
  }
  return <Designer />;
}

/** Saves shortly after each change; warns before leaving with unsaved changes. */
function useAutosave() {
  const project = useEditor((s) => s.project);
  const save = useEditor((s) => s.save);
  const markSaved = useEditor((s) => s.markSaved);

  useEffect(() => {
    if (!project || save !== 'unsaved') return;
    const timer = setTimeout(() => {
      markSaved('saving');
      getProjectRepository()
        .save(project)
        .then(() => markSaved('saved', project))
        .catch(() => markSaved('error'));
    }, 800);
    return () => clearTimeout(timer);
  }, [project, save, markSaved]);

  useEffect(() => {
    if (save === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function Designer() {
  const t = useTranslations('Editor');
  const project = useEditor((s) => s.project)!;
  const status = useEditor((s) => s.status);
  const apply = useEditor((s) => s.apply);
  const [dragging, setDragging] = useState<string | null>(null);
  useAutosave();

  const layout: ProjectLayout = useMemo(() => {
    const result = layoutProject(project);
    return { ...result, spreads: toSpreads(result.pages.map((p) => p.page)) };
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const s = useEditor.getState();
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !isTyping(e.target)) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault();
        turnPage(layout, e.key === 'PageDown' ? 1 : -1);
        return;
      }
      if (!s.selection.blockId) return;
      if (e.key === 'Escape') s.select({ blockId: undefined });
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected(layout, { delete: t('undo.delete'), hide: t('undo.hide') });
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected(layout, t('undo.duplicate'));
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        nudgeSelected(layout, e.key === 'ArrowUp' ? -1 : 1, t('undo.move'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout, t]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined;
    setDragging(data?.kind === 'palette' ? data.label : null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const from = e.active.data.current as DragData | undefined;
    const to = e.over?.data.current as DragData | undefined;
    if (!from || !to) return;
    const s = useEditor.getState();
    const pageIndex = currentPageIndex(layout, s.selection);

    if (from.kind === 'palette') {
      if (to.kind === 'page') addBlockToPage(layout, to.pageIndex, from.block, t('undo.add'));
      if (to.kind === 'layer')
        addBlockToPage(layout, pageIndex, from.block, t('undo.add'), to.blockId);
      return;
    }
    if (from.kind === 'layer' && to.kind === 'layer' && from.container === to.container) {
      const templateId = layout.pages[pageIndex]?.page.instance?.templateId;
      if (!templateId || from.index === to.index) return;
      apply(t('undo.move'), (p) => moveBlock(p, { templateId, blockId: from.blockId }, to.index));
      return;
    }
    if (
      from.kind === 'recipe' &&
      to.kind === 'recipe' &&
      from.path.join('.') === to.path.join('.') &&
      from.index !== to.index
    ) {
      apply(t('undo.reorderStructure'), (p) => moveRecipeChild(p, from.path, from.index, to.index));
    }
  };

  return (
    <LayoutContext.Provider value={layout}>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex h-screen flex-col">
          <Toolbar />
          <div className="flex min-h-0 flex-1">
            <aside
              aria-label={t('leftPanel')}
              className="flex w-72 shrink-0 flex-col border-r border-line bg-surface"
            >
              <LeftPanel />
            </aside>
            <main className="min-w-0 flex-1" lang={project.locale}>
              <Canvas />
            </main>
            <aside
              aria-label={t('inspector')}
              className="w-80 shrink-0 overflow-y-auto border-l border-line bg-surface"
            >
              <Inspector />
            </aside>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="rounded border border-accent bg-surface px-3 py-1.5 text-sm shadow-lg">
              {dragging}
            </div>
          )}
        </DragOverlay>
        <p role="status" aria-live="polite" className="sr-only">
          {status}
        </p>
      </DndContext>
    </LayoutContext.Provider>
  );
}
