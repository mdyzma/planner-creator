'use client';

import { withFormat } from '@planner/core';
import { templateUsage } from '@planner/editor';
import { localize } from '@planner/i18n';
import type { FormatId, Locale } from '@planner/schema';
import { FORMAT_IDS, LOCALES } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppBar, iconButton } from '@/components/AppBar';
import { Icon } from '@/components/Icon';
import { useEditor } from '@/lib/editorStore';
import { currentPageIndex, useLayout } from './context';
import { Segmented } from './controls';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5] as const;

/**
 * Two bars: the app bar (the planner: name, saving, undo, screens, export) and the canvas bar
 * (what the page edits apply to, format, language, view). Both keep one height on every page.
 */
export function Toolbar() {
  const t = useTranslations('Editor');
  const s = useEditor();
  const project = s.project!;

  const saveText = {
    saved: t('save.saved'),
    saving: t('save.saving'),
    unsaved: t('save.unsaved'),
    error: t('save.error'),
  }[s.save];

  const lastUndo = s.history.past.at(-1)?.label;
  const lastRedo = s.history.future.at(-1)?.label;

  return (
    <>
      <AppBar
        projectId={project.id}
        screen="editor"
        title={
          <h1>
            <PlannerName />
          </h1>
        }
      >
        <span
          className={`flex shrink-0 items-center gap-1 text-xs ${s.save === 'error' ? 'text-danger' : 'text-ink-muted'}`}
          data-save-state={s.save}
          title={saveText}
        >
          {s.save === 'saved' && <Icon name="check" size={14} />}
          {saveText}
        </span>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className={iconButton}
            disabled={!lastUndo}
            onClick={s.undo}
            aria-label={t('undo.button')}
            title={lastUndo ? t('undoWhat', { what: lastUndo }) : t('undo.button')}
            aria-keyshortcuts="Control+Z"
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            className={iconButton}
            disabled={!lastRedo}
            onClick={s.redo}
            aria-label={t('redo')}
            title={lastRedo ? t('redoWhat', { what: lastRedo }) : t('redo')}
            aria-keyshortcuts="Control+Shift+Z"
          >
            <Icon name="redo" />
          </button>
        </div>
      </AppBar>
      <CanvasBar />
    </>
  );
}

function CanvasBar() {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const layout = useLayout();
  const s = useEditor();
  const project = s.project!;

  const usage = useMemo(() => templateUsage(project), [project]);
  const page = layout.pages[currentPageIndex(layout, s.selection)];
  const instance = page?.page.instance;
  const templateName = page?.template ? localize(page.template.name, uiLocale) : '';
  const scopeText = instance
    ? t('scope.template', { count: usage[instance.templateId] ?? 0, name: templateName })
    : t('scope.templateShort');

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-bg px-4 py-1.5 text-sm">
      <Segmented
        label={t('scope.label')}
        value={s.scope}
        onChange={(scope) => s.set({ scope })}
        options={[
          [
            'template',
            // A fixed width, so the bar does not change as the layout name changes per page.
            <span key="t" className="inline-block w-60 truncate align-bottom" title={scopeText}>
              {scopeText}
            </span>,
          ],
          ['page', t('scope.page')],
        ]}
      />
      <span aria-hidden="true" className="h-5 w-px bg-line" />
      <Segmented
        label={t('format')}
        value={project.format}
        options={FORMAT_IDS.map((f) => [f, f] as const)}
        onChange={(f: FormatId) =>
          s.apply(t('undo.format', { format: f }), (p) => withFormat(p, f))
        }
      />
      <Segmented
        label={t('plannerLanguage')}
        value={project.locale}
        options={LOCALES.map((l) => [l, l.toUpperCase()] as const)}
        onChange={(locale: Locale) => s.apply(t('undo.language'), (p) => ({ ...p, locale }))}
      />

      <div className="ml-auto flex items-center gap-3">
        <Segmented
          label={t('view')}
          hideLabel
          value={s.view}
          onChange={(view) => s.set({ view })}
          options={[
            [
              'spread',
              <span key="s" className="flex items-center gap-1.5" title={t('spread')}>
                <Icon name="spread" />
                {t('spread')}
              </span>,
            ],
            [
              'single',
              <span key="p" className="flex items-center gap-1.5" title={t('single')}>
                <Icon name="page" />
                {t('single')}
              </span>,
            ],
          ]}
        />
        <select
          aria-label={t('zoom')}
          title={t('zoom')}
          className="rounded border border-line bg-surface px-2 py-1"
          value={s.zoom}
          onChange={(e) =>
            s.set({ zoom: e.target.value === 'fit' ? 'fit' : Number(e.target.value) })
          }
        >
          <option value="fit">{t('fit')}</option>
          {ZOOMS.map((z) => (
            <option key={z} value={z}>
              {z * 100}%
            </option>
          ))}
        </select>
        <ViewMenu />
      </div>
    </div>
  );
}

/** Guides, the 5 mm grid and snapping: set once in a while, so kept in a menu. */
function ViewMenu() {
  const t = useTranslations('Editor');
  const s = useEditor();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1 hover:bg-bg"
      >
        <Icon name="sliders" />
        {t('viewOptions')}
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 flex w-56 flex-col gap-2.5 rounded border border-line bg-surface p-3 shadow-lg">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.guides}
              onChange={(e) => s.set({ guides: e.target.checked })}
            />
            {t('guides')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.grid}
              onChange={(e) => s.set({ grid: e.target.checked })}
            />
            {t('grid')}
          </label>
          <label className="flex items-center justify-between gap-2">
            {t('snap')}
            <select
              className="rounded border border-line bg-surface px-2 py-1"
              value={s.snap}
              onChange={(e) => s.set({ snap: Number(e.target.value) as 1 | 5 })}
            >
              <option value={1}>1 mm</option>
              <option value={5}>5 mm</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

/** The planner's name, editable in place; it also names exported PDF and JSON files. */
function PlannerName() {
  const t = useTranslations('Editor');
  const saved = useEditor((s) => s.project!.meta.name);
  const apply = useEditor((s) => s.apply);
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);

  return (
    <input
      aria-label={t('plannerName')}
      title={t('plannerName')}
      className="w-72 max-w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 font-medium hover:border-line focus:border-line"
      value={text}
      maxLength={200}
      onChange={(e) => {
        setText(e.target.value);
        const name = e.target.value.trim();
        if (name) {
          apply(t('undo.rename'), (p) => ({ ...p, meta: { ...p.meta, name } }), 'rename');
        }
      }}
      onBlur={() => setText(saved)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
