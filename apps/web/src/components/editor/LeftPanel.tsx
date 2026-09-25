'use client';

import { useDraggable } from '@dnd-kit/core';
import { BUILT_IN_PRESETS } from '@planner/blocks';
import type { NewBlock } from '@planner/editor';
import { setVariable, templateUsage } from '@planner/editor';
import { localize } from '@planner/i18n';
import type { Locale, LocalizedText } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import type { LeftTab } from '@/lib/editorStore';
import { useEditor } from '@/lib/editorStore';
import { blockRegistry } from '@/lib/pages';
import { addBlockToPage } from './actions';
import type { DragData } from './EditorScreen';
import { currentPageIndex, useLayout } from './context';
import { inputClass, smallButton } from './controls';
import { LayersTab } from './LayersTab';
import { PagesTab } from './PagesTab';

const TABS: LeftTab[] = ['pages', 'layers', 'components', 'templates', 'content', 'variables'];

export function LeftPanel() {
  const t = useTranslations('Editor.tabs');
  const tab = useEditor((s) => s.tab);
  const set = useEditor((s) => s.set);
  const ids = useId();

  return (
    <>
      <div role="tablist" aria-label={t('label')} className="flex flex-wrap border-b border-line">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`${ids}-${id}`}
            aria-selected={tab === id}
            aria-controls={`${ids}-panel`}
            onClick={() => set({ tab: id })}
            className={`px-2.5 py-1.5 text-sm ${tab === id ? 'border-b-2 border-accent font-medium' : 'text-ink-muted hover:text-ink'}`}
          >
            {t(id)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${ids}-panel`}
        aria-labelledby={`${ids}-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto p-3 text-sm"
      >
        {tab === 'pages' && <PagesTab />}
        {tab === 'layers' && <LayersTab />}
        {tab === 'components' && <ComponentsTab />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'variables' && <VariablesTab />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

interface PaletteItem {
  id: string;
  label: LocalizedText;
  block: NewBlock;
}

function ComponentsTab() {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const layout = useLayout();
  const selection = useEditor((s) => s.selection);
  const index = currentPageIndex(layout, selection);
  const canAdd = Boolean(layout.pages[index]?.template);

  const presets: PaletteItem[] = BUILT_IN_PRESETS.map((p) => ({
    id: `preset:${p.id}`,
    label: p.label,
    block: { type: p.type, props: p.props as Record<string, unknown>, id: p.id },
  }));
  const categories = new Map<string, PaletteItem[]>();
  for (const def of blockRegistry.definitions) {
    const list = categories.get(def.category) ?? [];
    list.push({ id: `type:${def.type}`, label: def.label, block: { type: def.type } });
    categories.set(def.category, list);
  }

  const group = (title: string, items: PaletteItem[]) => (
    <section key={title} className="mb-4">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <PaletteEntry
            key={item.id}
            item={item}
            label={localize(item.label, uiLocale)}
            disabled={!canAdd}
            onAdd={() => addBlockToPage(layout, index, item.block, t('undo.add'))}
          />
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <p className="mb-3 text-xs text-ink-muted">
        {canAdd ? t('paletteHint') : t('paletteFiller')}
      </p>
      {group(t('presets'), presets)}
      {[...categories].map(([category, items]) =>
        group(t(`category.${category as 'text'}`), items),
      )}
    </>
  );
}

function PaletteEntry({
  item,
  label,
  disabled,
  onAdd,
}: {
  item: PaletteItem;
  label: string;
  disabled: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations('Editor');
  const data: DragData = { kind: 'palette', block: item.block, label };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.id}`,
    data,
    disabled,
  });
  return (
    <li
      className={`flex items-center gap-2 rounded border border-line px-2 py-1 ${isDragging ? 'opacity-40' : ''}`}
    >
      <span
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={t('dragToPage', { name: label })}
        className="flex-1 cursor-grab select-none"
      >
        <span aria-hidden="true" className="mr-1.5 text-ink-muted">
          ⠿
        </span>
        {label}
      </span>
      <button
        type="button"
        className={smallButton}
        disabled={disabled}
        onClick={onAdd}
        aria-label={t('addNamed', { name: label })}
      >
        {t('add')}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------

function TemplatesTab() {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const project = useEditor((s) => s.project)!;
  const select = useEditor((s) => s.select);
  const layout = useLayout();
  const usage = useMemo(() => templateUsage(project), [project]);

  const open = (templateId: string) => {
    const index = layout.pages.findIndex((p) => p.page.instance?.templateId === templateId);
    if (index >= 0)
      select({
        pageIndex: index,
        pageKey: layout.pages[index]!.page.instance!.key,
        blockId: undefined,
      });
  };

  return (
    <ul className="flex flex-col gap-2">
      {Object.values(project.template.pageTemplates).map((template) => (
        <li key={template.id} className="rounded border border-line p-2">
          <div className="flex items-baseline gap-2">
            <span className="font-medium">{localize(template.name, uiLocale)}</span>
            <span className="ml-auto text-xs text-ink-muted">
              {t('usedOn', { count: usage[template.id] ?? 0 })}
            </span>
          </div>
          {template.rationale && (
            <p className="mt-1 text-xs text-ink-muted">{localize(template.rationale, uiLocale)}</p>
          )}
          <button
            type="button"
            className={`${smallButton} mt-1.5`}
            disabled={!usage[template.id]}
            onClick={() => open(template.id)}
          >
            {t('showTemplate')}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ContentTab() {
  const t = useTranslations('Editor');
  const project = useEditor((s) => s.project)!;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-muted">{t('contentIntro')}</p>
      <ul className="flex flex-col gap-1">
        {project.content.map((library) => (
          <li key={library.library}>
            {library.library} · {t('items', { count: library.items.length })}
          </li>
        ))}
      </ul>
      <Link href={`/content?id=${project.id}`} className="underline">
        {t('openContent')}
      </Link>
      <Link href={`/translations?id=${project.id}`} className="underline">
        {t('openTranslations')}
      </Link>
    </div>
  );
}

/** Page variables filled in for every page; the rest print as a line to write on. */
const BUILT_IN_VARIABLES = [
  'plannerStartDate',
  'plannerEndDate',
  'currentDate',
  'dayName',
  'monthName',
  'weekNumber',
  'weekRange',
  'sobrietyDayNumber',
  'haltName',
  'haltFeelings',
];

function VariablesTab() {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const project = useEditor((s) => s.project)!;
  const apply = useEditor((s) => s.apply);
  const ids = useId();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">{t('variablesIntro')}</p>
      {project.template.variables.map((v) => {
        const value = project.generation.variables[v.name]?.value;
        return (
          <div key={v.name} className="flex flex-col gap-1">
            <label htmlFor={`${ids}-${v.name}`} className="flex items-baseline gap-2">
              {localize(v.label, uiLocale)}
              <code className="ml-auto text-xs text-ink-muted">{`{{${v.name}}}`}</code>
            </label>
            <input
              id={`${ids}-${v.name}`}
              type={v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'}
              className={inputClass}
              value={value === undefined ? '' : String(value)}
              onChange={(e) =>
                apply(
                  t('undo.variable', { name: v.name }),
                  (p) => setVariable(p, v.name, e.target.value, v.personal),
                  `var:${v.name}`,
                )
              }
            />
            {v.personal && <span className="text-xs text-ink-muted">{t('personal')}</span>}
          </div>
        );
      })}
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('automaticVariables')}
        </h3>
        <ul className="flex flex-wrap gap-1.5">
          {BUILT_IN_VARIABLES.map((name) => (
            <li key={name}>
              <code className="rounded bg-bg px-1 text-xs">{`{{${name}}}`}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export { BUILT_IN_VARIABLES };
