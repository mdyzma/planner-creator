'use client';

import type { FormatId, Locale } from '@planner/schema';
import { FORMAT_IDS, LOCALES, createProject } from '@planner/schema';
import type { ProjectSummary } from '@planner/storage';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { getProjectRepository, requestPersistentStorage } from '@/lib/repository';

const LOCALE_LABELS: Record<Locale, string> = { en: 'English', pl: 'Polski' };
const EXPORT_LABELS: Record<ProjectSummary['exportStatus'], string> = {
  never: 'Not exported',
  exported: 'Exported',
  stale: 'Changed since export',
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function ProjectDashboard() {
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

  return (
    <div className="space-y-8">
      <NewProjectForm onCreate={(input) => run(() => getProjectRepository().save(input))()} />

      {error && (
        <p role="alert" className="rounded border border-danger px-3 py-2 text-danger">
          {error}
        </p>
      )}

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="mb-3 text-lg font-medium">
          Your planners
        </h2>
        {projects === null ? (
          <p className="text-ink-muted">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-ink-muted">No planners yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-ink-muted">
                    {p.format} · {LOCALE_LABELS[p.locale]} · {p.pageCount} pages · edited{' '}
                    {dateFormat.format(new Date(p.updatedAt))} · {EXPORT_LABELS[p.exportStatus]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-line px-3 py-1.5 text-sm hover:bg-bg"
                    aria-label={`Duplicate ${p.name}`}
                    onClick={run(() => getProjectRepository().duplicate(p.id))}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="rounded border border-line px-3 py-1.5 text-sm text-danger hover:bg-bg"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${p.name}”? This cannot be undone.`)) {
                        void run(() => getProjectRepository().delete(p.id))();
                      }
                    }}
                  >
                    Delete
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
  const ids = useId();
  const [name, setName] = useState('6-Month Recovery Planner');
  const [format, setFormat] = useState<FormatId>('A4');
  const [locale, setLocale] = useState<Locale>('pl');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onCreate(
      createProject({
        id: crypto.randomUUID(),
        name: name.trim() || 'Untitled planner',
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
        New planner
      </h2>
      <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
        Name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Format
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
        Language
        <select
          className={field}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded bg-accent px-4 py-2 font-medium text-accent-ink hover:opacity-90"
      >
        New planner
      </button>
    </form>
  );
}
