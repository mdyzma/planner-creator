'use client';

import type { ContentIssue } from '@planner/content';
import {
  QUOTE_LENGTH_LIMITS,
  exportItemsCsv,
  filterItems,
  importItemsCsv,
  nextItemId,
  validateItems,
} from '@planner/content';
import { NO_REPEAT_WITHIN, measureContent } from '@planner/generator';
import type { ContentItem, ContentKind, Locale, PlannerProject } from '@planner/schema';
import { ContentKind as ContentKindSchema, LOCALES } from '@planner/schema';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProjectStatus } from '@/components/ProjectStatus';
import { Link } from '@/i18n/navigation';
import type { LocatedItem } from '@/lib/content';
import {
  ID_PREFIX,
  deleteItem,
  downloadText,
  itemsOf,
  redeal,
  updateItem,
  upsertItems,
} from '@/lib/content';
import { useProject } from '@/lib/useProject';

const KINDS = ContentKindSchema.options;
const LICENSES: ContentItem['license'][] = ['original', 'public-domain', 'cc-by', 'user'];
/** Kinds the generator currently places on pages. */
const DEALT_KINDS: readonly ContentKind[] = ['quote'];

/**
 * Content libraries (§24, M5): quotes and other texts, both languages side by side, with the
 * problems that would show in print, spreadsheet import/export and re-dealing onto the pages.
 */
export function ContentScreen() {
  const id = useSearchParams().get('id');
  const { state, save } = useProject(id);
  if (state.status !== 'ready') {
    return (
      <ProjectStatus
        status={state.status}
        message={state.status === 'error' ? state.message : undefined}
      />
    );
  }
  return <ContentEditor project={state.project} onChange={save} />;
}

function ContentEditor({
  project,
  onChange,
}: {
  project: PlannerProject;
  onChange: (p: PlannerProject) => Promise<void>;
}) {
  const t = useTranslations('Content');
  const ids = useId();
  const [kind, setKind] = useState<ContentKind>('quote');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [notice, setNotice] = useState<{ text: string; errors?: string[] } | null>(null);

  const located = useMemo(() => itemsOf(project, kind), [project, kind]);
  const items = located.map((l) => l.item);
  const issues = useMemo(() => validateItems(items), [items]);
  const categories = [...new Set(items.flatMap((i) => i.categories))].sort();
  const visibleIds = new Set(
    filterItems(items, {
      query,
      category: category || undefined,
      withIssues: onlyIssues ? issues : undefined,
    }).map((i) => i.id),
  );
  const visible = located.filter((l) => visibleIds.has(l.item.id));
  const coverage = useMemo(
    () => measureContent(project.document.root, project.content),
    [project.document.root, project.content],
  );

  const add = () => {
    const item: ContentItem = {
      id: nextItemId(items, ID_PREFIX[kind]),
      kind,
      text: {},
      license: 'original',
      categories: [],
      tags: [],
    };
    void onChange(upsertItems(project, kind, [item]));
  };

  const importCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = importItemsCsv(await file.text(), {
      existing: items,
      defaultKind: kind,
      idPrefix: ID_PREFIX[kind],
    });
    await onChange(upsertItems(project, kind, result.items));
    setNotice({
      text: t('importDone', { count: result.items.length }),
      errors: result.errors.map((err) => t('line', { line: err.line, message: err.message })),
    });
  };

  const doRedeal = async () => {
    const { project: next, report } = redeal(project);
    await onChange(next);
    setNotice({ text: t('redealt', { slots: report.slots }) });
  };

  const field = 'rounded border border-line bg-surface px-2 py-1';
  const dealt = DEALT_KINDS.includes(kind);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href={`/preview?id=${project.id}`} className="text-sm underline">
          {t('back')}
        </Link>
        <h1 className="text-xl font-semibold">
          {t('title')} · {project.meta.name}
        </h1>
        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </header>

      <nav aria-label={t('title')} className="mb-4 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === kind}
            onClick={() => setKind(k)}
            className={`rounded border border-line px-3 py-1 text-sm ${k === kind ? 'bg-accent text-accent-ink' : 'bg-surface'}`}
          >
            {t(`kind.${k}`)} ({itemsOf(project, k).length})
          </button>
        ))}
      </nav>

      {dealt ? (
        <div
          className="mb-4 rounded border border-line bg-surface px-4 py-3 text-sm"
          aria-live="polite"
        >
          <p>
            {t('coverage', {
              slots: coverage.slots,
              available: coverage.available,
              maxUses: coverage.maxUses,
            })}{' '}
            ·{' '}
            {coverage.minGap === undefined
              ? t('noRepeats')
              : t('minGap', { minGap: coverage.minGap })}
          </p>
          {coverage.minGap !== undefined && coverage.minGap < NO_REPEAT_WITHIN && (
            <p className="mt-1 text-danger">{t('repeatWarning')}</p>
          )}
          {coverage.missing > 0 && (
            <p className="mt-1 text-danger">{t('missingWarning', { count: coverage.missing })}</p>
          )}
        </div>
      ) : (
        <p className="mb-4 text-sm text-ink-muted">{t('unusedKind')}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          {t('search')}
          <input
            className={field}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          {t('category')}
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('allCategories')}</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(e) => setOnlyIssues(e.target.checked)}
          />
          {t('onlyIssues')}
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={`${field} hover:bg-bg`} onClick={add}>
            {t('add')}
          </button>
          <label className={`${field} cursor-pointer hover:bg-bg`} htmlFor={`${ids}-import`}>
            {t('import')}
          </label>
          <input
            id={`${ids}-import`}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void importCsv(e)}
          />
          <button
            type="button"
            className={`${field} hover:bg-bg`}
            onClick={() => downloadText(`${kind}s.csv`, exportItemsCsv(items))}
          >
            {t('export')}
          </button>
          {dealt && (
            <button
              type="button"
              className="rounded bg-accent px-3 py-1 font-medium text-accent-ink"
              onClick={() => void doRedeal()}
            >
              {t('redeal')}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-4 text-sm">
          <p>{notice.text}</p>
          {notice.errors && notice.errors.length > 0 && (
            <>
              <p className="mt-1 text-danger">{t('importErrors')}</p>
              <ul className="list-disc pl-5 text-danger">
                {notice.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-ink-muted">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {visible.map((at) => (
            <ItemRow
              key={`${at.library}/${at.item.id}/${at.index}`}
              at={at}
              issues={issues.filter((i) => i.itemId === at.item.id)}
              limited={kind === 'quote' || kind === 'affirmation'}
              onSave={(item) => onChange(updateItem(project, at, item))}
              onDelete={() => onChange(deleteItem(project, at))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function ItemRow({
  at,
  issues,
  limited,
  onSave,
  onDelete,
}: {
  at: LocatedItem;
  issues: ContentIssue[];
  limited: boolean;
  onSave: (item: ContentItem) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations('Content');
  const common = useTranslations('Common');
  const [draft, setDraft] = useState(at.item);
  useEffect(() => setDraft(at.item), [at.item]);

  // Save when a field loses focus, using the committed draft plus the field's own value.
  const commit = (next: ContentItem) => {
    if (JSON.stringify(next) !== JSON.stringify(at.item)) void onSave(next);
  };

  const language = (l: Locale) => common(`languages.${l}`);
  const field = 'w-full rounded border border-line bg-bg px-2 py-1 text-sm';

  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_1fr]">
      <div className="text-sm">
        <p className="font-mono">{at.item.id}</p>
        {issues.map((issue, i) => (
          <p key={i} className="mt-1 rounded border border-danger px-1.5 text-xs text-danger">
            {t(`issues.${issue.code}`, {
              language: issue.locale ? language(issue.locale) : '',
              other: issue.otherId ?? '',
            })}
          </p>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-danger underline"
          onClick={() => {
            if (window.confirm(t('confirmDelete', { id: at.item.id }))) void onDelete();
          }}
        >
          {t('delete')}
        </button>
      </div>
      {LOCALES.map((l) => {
        const text = draft.text[l] ?? '';
        const over = limited && text.length > QUOTE_LENGTH_LIMITS.A5;
        return (
          <div key={l} className="flex flex-col gap-1">
            <textarea
              lang={l}
              rows={3}
              className={field}
              aria-label={t('textLabel', { id: at.item.id, language: language(l) })}
              aria-invalid={
                issues.some((i) => i.locale === l && i.severity === 'error') || undefined
              }
              value={text}
              onChange={(e) => setDraft({ ...draft, text: { ...draft.text, [l]: e.target.value } })}
              onBlur={(e) =>
                commit({ ...draft, text: { ...draft.text, [l]: e.currentTarget.value } })
              }
            />
            {limited && (
              <span className={`self-end text-xs ${over ? 'text-danger' : 'text-ink-muted'}`}>
                {t('chars', { count: text.length, max: QUOTE_LENGTH_LIMITS.A5 })}
              </span>
            )}
          </div>
        );
      })}
      <div className="grid gap-2 text-xs md:col-span-3 md:grid-cols-5">
        <label className="flex flex-col gap-1">
          {t('author')}
          <input
            className={field}
            value={draft.author ?? ''}
            onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            onBlur={(e) => commit({ ...draft, author: e.currentTarget.value.trim() || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t('source')}
          <input
            className={field}
            value={draft.source ?? ''}
            onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            onBlur={(e) => commit({ ...draft, source: e.currentTarget.value.trim() || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t('license')}
          <select
            className={field}
            value={draft.license}
            onChange={(e) =>
              commit({ ...draft, license: e.target.value as ContentItem['license'] })
            }
          >
            {LICENSES.map((l) => (
              <option key={l} value={l}>
                {t(`licenses.${l}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('categories')}
          <input
            className={field}
            defaultValue={draft.categories.join(', ')}
            key={`c-${draft.categories.join(',')}`}
            onBlur={(e) => commit({ ...draft, categories: splitList(e.currentTarget.value) })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t('tags')}
          <input
            className={field}
            defaultValue={draft.tags.join(', ')}
            key={`t-${draft.tags.join(',')}`}
            onBlur={(e) => commit({ ...draft, tags: splitList(e.currentTarget.value) })}
          />
        </label>
      </div>
    </li>
  );
}
