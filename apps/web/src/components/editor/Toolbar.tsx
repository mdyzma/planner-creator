'use client';

import { withFormat } from '@planner/core';
import { templateUsage } from '@planner/editor';
import { localize } from '@planner/i18n';
import type { FormatId, Locale } from '@planner/schema';
import { FORMAT_IDS, LOCALES } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { useEditor } from '@/lib/editorStore';
import { currentPageIndex, useLayout } from './context';
import { Segmented } from './controls';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export function Toolbar() {
  const t = useTranslations('Editor');
  const common = useTranslations('Common');
  const uiLocale = useLocale() as Locale;
  const layout = useLayout();
  const s = useEditor();
  const project = s.project!;

  const usage = useMemo(() => templateUsage(project), [project]);
  const page = layout.pages[currentPageIndex(layout, s.selection)];
  const instance = page?.page.instance;
  const templateName = page?.template ? localize(page.template.name, uiLocale) : '';

  const saveText = {
    saved: t('save.saved'),
    saving: t('save.saving'),
    unsaved: t('save.unsaved'),
    error: t('save.error'),
  }[s.save];

  const lastUndo = s.history.past.at(-1)?.label;
  const lastRedo = s.history.future.at(-1)?.label;
  const button =
    'rounded border border-line bg-surface px-2.5 py-1 hover:bg-bg disabled:opacity-40 disabled:hover:bg-surface';

  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface px-4 py-2 text-sm">
      <Link href="/" className="underline">
        {common('planners')}
      </Link>
      <h1 className="font-medium">
        <PlannerName />
      </h1>
      <div className="flex gap-1">
        <button
          type="button"
          className={button}
          disabled={!lastUndo}
          onClick={s.undo}
          title={lastUndo ? t('undoWhat', { what: lastUndo }) : undefined}
          aria-keyshortcuts="Control+Z"
        >
          {t('undo.button')}
        </button>
        <button
          type="button"
          className={button}
          disabled={!lastRedo}
          onClick={s.redo}
          title={lastRedo ? t('redoWhat', { what: lastRedo }) : undefined}
          aria-keyshortcuts="Control+Shift+Z"
        >
          {t('redo')}
        </button>
      </div>
      <span
        className={s.save === 'error' ? 'text-danger' : 'text-ink-muted'}
        data-save-state={s.save}
      >
        {saveText}
      </span>

      <Segmented
        label={t('scope.label')}
        value={s.scope}
        onChange={(scope) => s.set({ scope })}
        options={[
          [
            'template',
            instance
              ? t('scope.template', {
                  count: usage[instance.templateId] ?? 0,
                  name: templateName,
                })
              : t('scope.templateShort'),
          ],
          ['page', t('scope.page')],
        ]}
      />

      <Segmented
        label={t('view')}
        value={s.view}
        onChange={(view) => s.set({ view })}
        options={[
          ['spread', t('spread')],
          ['single', t('single')],
        ]}
      />
      <label className="flex items-center gap-2">
        {t('zoom')}
        <select
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
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={s.guides}
          onChange={(e) => s.set({ guides: e.target.checked })}
        />
        {t('guides')}
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={s.grid}
          onChange={(e) => s.set({ grid: e.target.checked })}
        />
        {t('grid')}
      </label>
      <label className="flex items-center gap-2">
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

      <nav className="ml-auto flex items-center gap-4">
        <Link href={`/preview?id=${project.id}`} className="underline">
          {t('preview')}
        </Link>
        <Link href={`/export?id=${project.id}`} className="underline">
          {t('export')}
        </Link>
        <LanguageSwitcher />
      </nav>
    </header>
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
