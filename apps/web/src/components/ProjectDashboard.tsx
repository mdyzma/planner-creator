'use client';

import { NO_REPEAT_WITHIN } from '@planner/generator';
import { localize } from '@planner/i18n';
import type { FormatId, Locale, PlannerProject } from '@planner/schema';
import { FORMAT_IDS, LOCALES } from '@planner/schema';
import type { ProjectSummary } from '@planner/storage';
import { newId } from '@planner/storage';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { ModulePicker } from '@/components/ModulePicker';
import { Link, useRouter } from '@/i18n/navigation';
import { createGeneratedProject } from '@/lib/newProject';
import { getProjectRepository, requestPersistentStorage } from '@/lib/repository';
import { BUNDLED_TEMPLATES, firstOfNextMonth, spineMm } from '@/lib/templates';
import { asNewProject, localeFor, readImport } from '@/lib/transfer';

export function ProjectDashboard() {
  const t = useTranslations('Dashboard');
  const common = useTranslations('Common');
  const format = useFormatter();
  const uiLocale = useLocale() as Locale;
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await getProjectRepository().list());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void requestPersistentStorage();
    void refresh();
  }, [refresh]);

  const run = (action: () => Promise<unknown>) => async () => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const create = async (project: PlannerProject) => {
    setError(null);
    try {
      await getProjectRepository().save(project);
      router.push(`/editor?id=${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const action = 'rounded border border-line px-3 py-1.5 text-sm hover:bg-bg';

  /** Imports a planner backup or a template (bundle) from a JSON file (brief 28). */
  const importFile = async (file: File) => {
    setError(null);
    const result = readImport(await file.text());
    const now = new Date().toISOString();
    if (result.kind === 'error') {
      const known = ['too-large', 'not-json', 'unknown'].includes(result.message);
      setError(
        t('importFailed', {
          reason: known
            ? t(`importReason.${result.message as 'too-large' | 'not-json' | 'unknown'}`)
            : result.message,
        }),
      );
      return;
    }
    if (result.kind === 'project') {
      await create(asNewProject(result.project, newId(), now));
      return;
    }
    const { template, content } = result;
    const { project } = createGeneratedProject({
      bundle: { template, content },
      id: newId(),
      name: localize(template.name, uiLocale) || t('untitled'),
      format: template.supportedFormats[0]!,
      locale: localeFor(template, uiLocale),
      now,
      startDate: template.sections.length > 0 ? firstOfNextMonth() : undefined,
      durationMonths: template.defaults.generation.durationMonths ?? 6,
    });
    await create(project);
  };

  return (
    <div className="space-y-8">
      <NewProjectForm onCreate={(project) => void create(project)} />

      {error && (
        <p role="alert" className="rounded border border-danger px-3 py-2 text-danger">
          {error}
        </p>
      )}

      <section aria-labelledby="projects-heading">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="projects-heading" className="text-lg font-medium">
            {t('yourPlanners')}
          </h2>
          <label className={`${action} ml-auto cursor-pointer`}>
            {t('import')}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void importFile(file);
              }}
            />
          </label>
        </div>
        {projects === null ? (
          <p className="text-ink-muted">{common('loading')}</p>
        ) : projects.length === 0 ? (
          <p className="text-ink-muted">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-ink-muted">
                    {t('summary', {
                      format: p.format,
                      language: common(`languages.${p.locale}`),
                      pages: t('pages', { count: p.pageCount }),
                      date: format.dateTime(new Date(p.updatedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                      status: t(`status.${p.exportStatus}`),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/editor?id=${p.id}`}
                    className={`${action} bg-accent font-medium text-accent-ink hover:bg-accent`}
                    aria-label={t('editLabel', { name: p.name })}
                  >
                    {t('edit')}
                  </Link>
                  <Link
                    href={`/export?id=${p.id}`}
                    className={action}
                    aria-label={t('exportLabel', { name: p.name })}
                  >
                    {t('export')}
                  </Link>
                  <Link
                    href={`/preview?id=${p.id}`}
                    className={action}
                    aria-label={t('previewLabel', { name: p.name })}
                  >
                    {t('preview')}
                  </Link>
                  <Link
                    href={`/translations?id=${p.id}`}
                    className={action}
                    aria-label={t('translationsLabel', { name: p.name })}
                  >
                    {t('translations')}
                  </Link>
                  <Link
                    href={`/content?id=${p.id}`}
                    className={action}
                    aria-label={t('contentLabel', { name: p.name })}
                  >
                    {t('content')}
                  </Link>
                  <button
                    type="button"
                    className={action}
                    aria-label={t('duplicateLabel', { name: p.name })}
                    onClick={run(() => getProjectRepository().duplicate(p.id))}
                  >
                    {t('duplicate')}
                  </button>
                  <button
                    type="button"
                    className={`${action} text-danger`}
                    aria-label={t('deleteLabel', { name: p.name })}
                    onClick={() => {
                      if (window.confirm(t('confirmDelete', { name: p.name }))) {
                        void run(() => getProjectRepository().delete(p.id))();
                      }
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * New-planner form (§9.1 wizard, compact): template, name, format, planner language, start date
 * and length, with a live page count before anything is created (§2, F1).
 */
function NewProjectForm({ onCreate }: { onCreate: (project: PlannerProject) => void }) {
  const t = useTranslations('Dashboard');
  const common = useTranslations('Common');
  const uiLocale = useLocale();
  const ids = useId();
  const [templateId, setTemplateId] = useState(BUNDLED_TEMPLATES[0]!.template.id);
  const bundle = BUNDLED_TEMPLATES.find((b) => b.template.id === templateId)!;
  const [format, setFormat] = useState<FormatId>('A4');
  const [locale, setLocale] = useState<Locale>('pl');
  const [startDate, setStartDate] = useState(firstOfNextMonth);
  const [undated, setUndated] = useState(false);
  const defaultMonths = (b: typeof bundle) => b.template.defaults.generation.durationMonths ?? 6;
  const [months, setMonths] = useState(() => defaultMonths(bundle));
  // The suggested name follows the template and the chosen length ("Day by Day — 6 months")
  // until the user types their own.
  const [customName, setCustomName] = useState<string | null>(null);
  // Modules switched on or off; empty means the template's defaults (its first edition).
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const name =
    customName ??
    t('defaultName', {
      template: localize(bundle.template.name, uiLocale as Locale),
      count: months,
    });

  const dated = !undated && /^\d{4}-\d{2}-\d{2}$/.test(startDate);

  // Generating is fast (a few ms), so the page count follows every change.
  const preview = useMemo(
    () =>
      createGeneratedProject({
        bundle,
        id: 'preview',
        name: name.trim() || t('untitled'),
        format,
        locale,
        now: new Date(0).toISOString(),
        startDate: dated ? startDate : undefined,
        durationMonths: months,
        modules,
      }).result,
    [bundle, name, t, format, locale, dated, startDate, months, modules],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { project } = createGeneratedProject({
      bundle,
      id: newId(),
      name: name.trim() || t('untitled'),
      format,
      locale,
      now: new Date().toISOString(),
      startDate: dated ? startDate : undefined,
      durationMonths: months,
      modules,
    });
    onCreate(project);
  };

  const field = 'rounded border border-line bg-surface px-3 py-2';
  const hasPages = preview.budget.total > 0;
  const { content } = preview;
  const quotesLow = content.slots > 0 && (content.minGap ?? Infinity) < NO_REPEAT_WITHIN;

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${ids}-heading`}
      className="space-y-4 rounded-lg border border-line bg-surface p-4"
    >
      <h2 id={`${ids}-heading`} className="text-lg font-medium">
        {t('newPlanner')}
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t('template')}
          <select
            className={field}
            value={templateId}
            onChange={(e) => {
              const next = BUNDLED_TEMPLATES.find((b) => b.template.id === e.target.value)!;
              setTemplateId(next.template.id);
              setModules({});
              // Each template suggests its own length: six months, or a year for the weekly one.
              setMonths(defaultMonths(next));
            }}
          >
            {BUNDLED_TEMPLATES.map((b) => (
              <option key={b.template.id} value={b.template.id}>
                {localize(b.template.name, uiLocale as Locale)}
              </option>
            ))}
          </select>
        </label>
        <ModulePicker
          template={bundle.template}
          modules={modules}
          onChange={setModules}
          fieldClass={field}
        />
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
          {t('name')}
          <input
            className={field}
            value={name}
            onChange={(e) => setCustomName(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t('format')}
          <select
            className={field}
            value={format}
            onChange={(e) => setFormat(e.target.value as FormatId)}
          >
            {FORMAT_IDS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('plannerLanguage')}
          <select
            className={field}
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {common(`languages.${l}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('startDate')}
          <input
            type="date"
            className={field}
            value={startDate}
            disabled={undated}
            required={!undated}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={undated} onChange={(e) => setUndated(e.target.checked)} />
          {t('undated')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('length')}
          <select
            className={field}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {t('months', { count: m })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 font-medium text-accent-ink hover:opacity-90"
        >
          {t('create')}
        </button>
        <div className="text-sm text-ink-muted" aria-live="polite">
          {hasPages && (
            <p>
              {t('budget', {
                pages: preview.budget.total,
                sheets: preview.budget.sheets,
                spine: spineMm(preview.budget.sheets),
              })}
            </p>
          )}
          {content.slots > 0 && (
            <p>
              {t('quotes', {
                available: content.available,
                slots: content.slots,
                maxUses: content.maxUses,
              })}
              {quotesLow && <span className="ml-2 text-danger">{t('quotesLow')}</span>}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
