'use client';

import type { FormatId, Locale } from '@planner/schema';
import { FORMAT_IDS, LOCALES, createProject } from '@planner/schema';
import type { ProjectSummary } from '@planner/storage';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { createTherapeuticDemo } from '@/fixtures/therapeuticDemo';
import { Link } from '@/i18n/navigation';
import { getProjectRepository, requestPersistentStorage } from '@/lib/repository';

export function ProjectDashboard() {
  const t = useTranslations('Dashboard');
  const common = useTranslations('Common');
  const format = useFormatter();
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

  const action = 'rounded border border-line px-3 py-1.5 text-sm hover:bg-bg';

  return (
    <div className="space-y-8">
      <NewProjectForm onCreate={(input) => run(() => getProjectRepository().save(input))()} />
      <p className="text-sm text-ink-muted">
        {t('devPrefix')}{' '}
        <button
          type="button"
          className="underline"
          onClick={run(() =>
            getProjectRepository().save(
              createTherapeuticDemo({
                id: crypto.randomUUID(),
                name: t('defaultName'),
                now: new Date().toISOString(),
                format: 'A4',
                locale: 'pl',
              }),
            ),
          )}
        >
          {t('devDemoButton')}
        </button>{' '}
        {t('devDemoSuffix')}
      </p>

      {error && (
        <p role="alert" className="rounded border border-danger px-3 py-2 text-danger">
          {error}
        </p>
      )}

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="mb-3 text-lg font-medium">
          {t('yourPlanners')}
        </h2>
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

function NewProjectForm({
  onCreate,
}: {
  onCreate: (project: ReturnType<typeof createProject>) => void;
}) {
  const t = useTranslations('Dashboard');
  const common = useTranslations('Common');
  const ids = useId();
  const [name, setName] = useState(() => t('defaultName'));
  const [format, setFormat] = useState<FormatId>('A4');
  const [locale, setLocale] = useState<Locale>('pl');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onCreate(
      createProject({
        id: crypto.randomUUID(),
        name: name.trim() || t('untitled'),
        format,
        locale,
        now: new Date().toISOString(),
      }),
    );
  };

  const field = 'rounded border border-line bg-surface px-3 py-2';

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${ids}-heading`}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <h2 id={`${ids}-heading`} className="sr-only">
        {t('newPlanner')}
      </h2>
      <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
        {t('name')}
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
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
      <button
        type="submit"
        className="rounded bg-accent px-4 py-2 font-medium text-accent-ink hover:opacity-90"
      >
        {t('newPlanner')}
      </button>
    </form>
  );
}
