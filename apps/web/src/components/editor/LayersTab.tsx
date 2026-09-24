'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BlockEntry } from '@planner/core';
import { listBlocks, resolveTemplateForFormat } from '@planner/core';
import { setBlockHiddenOnPage } from '@planner/editor';
import { localize } from '@planner/i18n';
import type { Locale } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useEditor } from '@/lib/editorStore';
import { blockRegistry } from '@/lib/pages';
import type { DragData } from './EditorScreen';
import { currentPageIndex, useLayout } from './context';
import { smallButton } from './controls';

/** The container a block sits in, from its pointer: `/body/children/1` or `/outerRail`. */
const containerOf = (entry: BlockEntry) =>
  entry.region === 'body'
    ? entry.pointer.replace(/\/children\/\d+\/block$/, '') || '/body'
    : `/${entry.region}`;

export function LayersTab() {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const project = useEditor((s) => s.project)!;
  const layout = useLayout();
  const selection = useEditor((s) => s.selection);
  const page = layout.pages[currentPageIndex(layout, selection)];
  const instance = page?.page.instance;
  const source = instance && project.template.pageTemplates[instance.templateId];

  const groups = useMemo(() => {
    if (!source) return [];
    // Every block in the template for this format, including ones hidden on this page.
    const entries = listBlocks(resolveTemplateForFormat(source, project.format).template);
    const byContainer = new Map<string, BlockEntry[]>();
    for (const entry of entries) {
      const key = containerOf(entry);
      byContainer.set(key, [...(byContainer.get(key) ?? []), entry]);
    }
    return [...byContainer];
  }, [source, project.format]);

  if (!page || !instance || !source) return <p className="text-ink-muted">{t('layersFiller')}</p>;

  const groupTitle = (container: string, entries: BlockEntry[]) => {
    if (container === '/outerRail') return t('container.rail');
    if (container === '/free') return t('container.free');
    return entries[0]?.container === 'row' ? t('container.row') : t('container.stack');
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        {t('layersOf', { name: localize(source.name, uiLocale) })} {t('layersHint')}
      </p>
      {groups.map(([container, entries]) => (
        <section key={container}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {groupTitle(container, entries)}
          </h3>
          <SortableContext
            items={entries.map((e) => e.block.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-1">
              {entries.map((entry) => (
                <LayerRow
                  key={entry.block.id}
                  entry={entry}
                  container={container}
                  pageIndex={page.page.index}
                  pageKey={instance.key}
                  hidden={page.hidden.includes(entry.block.id)}
                  overridden={Boolean(instance.overrides?.[entry.block.id])}
                  hiddenOnPage={instance.overrides?.[entry.block.id]?.hidden === true}
                />
              ))}
            </ul>
          </SortableContext>
        </section>
      ))}
    </div>
  );
}

function LayerRow({
  entry,
  container,
  pageIndex,
  pageKey,
  hidden,
  overridden,
  hiddenOnPage,
}: {
  entry: BlockEntry;
  container: string;
  pageIndex: number;
  pageKey: string;
  hidden: boolean;
  overridden: boolean;
  hiddenOnPage: boolean;
}) {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const selected = useEditor(
    (s) => s.selection.blockId === entry.block.id && s.selection.pageKey === pageKey,
  );
  const select = useEditor((s) => s.select);
  const apply = useEditor((s) => s.apply);
  const data: DragData = {
    kind: 'layer',
    blockId: entry.block.id,
    container,
    index: entry.index,
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: entry.block.id, data, disabled: entry.block.locked });

  const def = blockRegistry.get(entry.block.type);
  const name = def ? localize(def.label, uiLocale) : entry.block.type;
  const hiddenByRule = hidden && !hiddenOnPage;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1.5 rounded border px-1.5 py-1 ${
        selected ? 'border-[var(--ui-focus)] bg-bg' : 'border-line'
      } ${isDragging ? 'opacity-50' : ''} ${isOver ? 'ring-2 ring-accent' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={entry.block.locked}
        aria-label={t('reorder', { name: `${name} (${entry.block.id})` })}
        className="cursor-grab text-ink-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⠿
      </button>
      <button
        type="button"
        onClick={() => select({ pageIndex, pageKey, blockId: entry.block.id })}
        className={`min-w-0 flex-1 truncate text-left ${hidden ? 'text-ink-muted line-through' : ''}`}
        aria-pressed={selected}
      >
        {name} <span className="text-xs text-ink-muted">{entry.block.id}</span>
      </button>
      {overridden && !hidden && (
        <span className="text-xs" title={t('overriddenHint')}>
          ◆
        </span>
      )}
      {entry.block.locked && <span className="text-xs text-ink-muted">{t('locked')}</span>}
      {hiddenOnPage && (
        <button
          type="button"
          className={smallButton}
          onClick={() =>
            apply(t('undo.show'), (p) => setBlockHiddenOnPage(p, pageKey, entry.block.id, false))
          }
        >
          {t('show')}
        </button>
      )}
      {hiddenByRule && <span className="text-xs text-ink-muted">{t('hiddenByRule')}</span>}
    </li>
  );
}
