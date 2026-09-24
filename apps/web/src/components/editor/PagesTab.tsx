'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { RecipePath } from '@planner/editor';
import { setPageEnabled, setRecipeChildEnabled, setSectionEnabled } from '@planner/editor';
import { formatDate, localize } from '@planner/i18n';
import type { Locale, PageInstance, PageRef, SectionNode, SectionTemplate } from '@planner/schema';
import { countPageInstances, isPageInstance } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useEditor } from '@/lib/editorStore';
import type { DragData } from './EditorScreen';
import { currentPageIndex, useLayout } from './context';

export function PagesTab() {
  const t = useTranslations('Editor');
  const project = useEditor((s) => s.project)!;
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('structure')}
        </h3>
        <p className="mb-2 text-xs text-ink-muted">{t('structureHint')}</p>
        <RecipeList entries={project.template.sections} path={[]} />
      </section>
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('plannerPages')}
        </h3>
        <p className="mb-2 text-xs text-ink-muted">{t('plannerPagesHint')}</p>
        <ul role="tree" aria-label={t('plannerPages')}>
          {project.document.root.children.map((child) => (
            <TreeNode key={child.key} node={child} depth={0} />
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Structure recipe

function RecipeList({
  entries,
  path,
}: {
  entries: Array<SectionTemplate | PageRef>;
  path: RecipePath;
}) {
  const ids = entries.map((_, i) => `recipe:${path.join('.')}:${i}`);
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul className={`flex flex-col gap-1 ${path.length > 0 ? 'mt-1 ml-4' : ''}`}>
        {entries.map((entry, i) => (
          <RecipeRow key={ids[i]} id={ids[i]!} entry={entry} path={path} index={i} />
        ))}
      </ul>
    </SortableContext>
  );
}

function RecipeRow({
  id,
  entry,
  path,
  index,
}: {
  id: string;
  entry: SectionTemplate | PageRef;
  path: RecipePath;
  index: number;
}) {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const project = useEditor((s) => s.project)!;
  const apply = useEditor((s) => s.apply);
  const data: DragData = { kind: 'recipe', path, index };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
  });

  const isPage = 'page' in entry;
  const name = isPage
    ? localize(project.template.pageTemplates[entry.page]?.name, uiLocale) || entry.page
    : localize(entry.title, uiLocale);
  const repeat = !isPage && entry.repeat ? t(`repeat.${entry.repeat.over}`) : '';
  const enabled = entry.enabled !== false;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-50' : ''}
    >
      <div className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-bg">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('reorder', { name })}
          className="cursor-grab text-ink-muted"
        >
          ⠿
        </button>
        <input
          type="checkbox"
          checked={enabled}
          aria-label={t('includeNamed', { name })}
          onChange={(e) =>
            apply(e.target.checked ? t('undo.includeSection') : t('undo.excludeSection'), (p) =>
              setRecipeChildEnabled(p, path, index, e.target.checked),
            )
          }
        />
        <span className={enabled ? '' : 'text-ink-muted line-through'}>{name}</span>
        {repeat && <span className="ml-auto text-xs text-ink-muted">{repeat}</span>}
      </div>
      {!isPage && entry.children.length > 0 && (
        <RecipeList entries={entry.children} path={[...path, index]} />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// This planner's pages

function TreeNode({ node, depth }: { node: SectionNode | PageInstance; depth: number }) {
  return isPageInstance(node) ? (
    <PageRow page={node} depth={depth} />
  ) : (
    <SectionRow section={node} depth={depth} />
  );
}

function SectionRow({ section, depth }: { section: SectionNode; depth: number }) {
  const t = useTranslations('Editor');
  const project = useEditor((s) => s.project)!;
  const apply = useEditor((s) => s.apply);
  const layout = useLayout();
  const selection = useEditor((s) => s.selection);
  const onPath = layout.pages[currentPageIndex(layout, selection)]?.page.sectionPath.includes(
    section.key,
  );
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? Boolean(onPath);
  const title = localize(section.title, project.locale);

  return (
    <li role="treeitem" aria-expanded={expanded} aria-selected={false}>
      <div
        className="flex items-center gap-1.5 rounded py-0.5 hover:bg-bg"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-label={expanded ? t('collapse', { name: title }) : t('expand', { name: title })}
          className="w-4 text-ink-muted"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <input
          type="checkbox"
          checked={section.enabled}
          aria-label={t('includeNamed', { name: title })}
          onChange={(e) =>
            apply(e.target.checked ? t('undo.includePages') : t('undo.excludePages'), (p) =>
              setSectionEnabled(p, section.key, e.target.checked),
            )
          }
        />
        <span className={`truncate ${section.enabled ? '' : 'text-ink-muted line-through'}`}>
          {title}
        </span>
        <span className="ml-auto shrink-0 text-xs text-ink-muted">
          {countPageInstances(section)}
        </span>
      </div>
      {expanded && (
        <ul role="group">
          {section.children.map((child) => (
            <TreeNode key={child.key} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function PageRow({ page, depth }: { page: PageInstance; depth: number }) {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const project = useEditor((s) => s.project)!;
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const layout = useLayout();
  const current = useEditor(
    (s) => layout.pages[currentPageIndex(layout, s.selection)]?.page.instance?.key === page.key,
  );
  const index = layout.pages.findIndex((p) => p.page.instance?.key === page.key);
  const template = project.template.pageTemplates[page.templateId];
  const name = [
    localize(template?.name, uiLocale) || page.templateId,
    page.context.date && formatDate(page.context.date, uiLocale, 'day-month'),
  ]
    .filter(Boolean)
    .join(' · ');
  const edits = Object.keys(page.overrides ?? {}).length;

  return (
    <li role="treeitem" aria-selected={current}>
      <div
        className={`flex items-center gap-1.5 rounded py-0.5 ${current ? 'bg-bg font-medium' : 'hover:bg-bg'}`}
        style={{ paddingLeft: `${depth * 12 + 16}px` }}
      >
        <input
          type="checkbox"
          checked={page.enabled}
          aria-label={t('includeNamed', { name })}
          onChange={(e) =>
            apply(e.target.checked ? t('undo.includePages') : t('undo.excludePages'), (p) =>
              setPageEnabled(p, page.key, e.target.checked),
            )
          }
        />
        <button
          type="button"
          disabled={index < 0}
          onClick={() => select({ pageIndex: index, pageKey: page.key, blockId: undefined })}
          className={`truncate text-left ${page.enabled ? '' : 'text-ink-muted line-through'}`}
        >
          {name}
        </button>
        {index >= 0 && (
          <span className="ml-auto shrink-0 text-xs text-ink-muted">
            {edits > 0 && (
              <span title={t('pageEdits', { count: edits })} className="mr-1">
                ◆
              </span>
            )}
            {t('pageNumber', { number: layout.pages[index]!.page.number })}
          </span>
        )}
      </div>
    </li>
  );
}
