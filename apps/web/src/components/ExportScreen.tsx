'use client';

import { scanTranslations, localize } from '@planner/i18n';
import type { OutputFile } from '@planner/pdf';
import { calibrationPdf, planExport } from '@planner/pdf';
import type { Locale, PlannerProject, PrintProfile } from '@planner/schema';
import { PAGE_FORMATS } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProjectStatus } from '@/components/ProjectStatus';
import { Link } from '@/i18n/navigation';
import { downloadText } from '@/lib/content';
import {
  ExportError,
  downloadBytes,
  exportPdf,
  exportServiceAvailable,
  exportServiceUrl,
  fileStem,
  usesLocalExportService,
} from '@/lib/exportClient';
import { getProjectRepository } from '@/lib/repository';
import { projectToJson, templateToJson } from '@/lib/transfer';
import { useProject } from '@/lib/useProject';

/** Print profiles offered per format (§8.4). Booklet and print-shop come later. */
type OfferedProfile = Extract<
  PrintProfile,
  'home-duplex' | 'home-manual-duplex' | 'home-a5-2up' | 'home-a5-native'
>;
const PROFILES: Record<'A4' | 'A5', OfferedProfile[]> = {
  A4: ['home-duplex', 'home-manual-duplex'],
  A5: ['home-a5-2up', 'home-a5-native', 'home-manual-duplex'],
};

type Job =
  | { state: 'idle' }
  | { state: 'running'; done: number; total: number }
  | { state: 'done'; files: OutputFile[]; stem: string }
  | { state: 'error'; message: string };

export function ExportScreen() {
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
  return <Export project={state.project} onChange={save} />;
}

function Export({
  project,
  onChange,
}: {
  project: PlannerProject;
  onChange: (p: PlannerProject) => void;
}) {
  const t = useTranslations('Export');
  const common = useTranslations('Common');
  const uiLocale = useLocale() as Locale;
  const ids = useId();

  const profiles = PROFILES[project.format];
  const [profile, setProfile] = useState<OfferedProfile>(
    (profiles as PrintProfile[]).includes(project.print.profile)
      ? (project.print.profile as OfferedProfile)
      : profiles[0]!,
  );
  /** Chosen top-level sections; `null` means all of them (the whole planner). */
  const [chosen, setChosen] = useState<ReadonlySet<string> | null>(null);
  const [reverseBacks, setReverseBacks] = useState(true);
  const [samples, setSamples] = useState(false);
  const [service, setService] = useState<'checking' | 'ready' | 'offline'>('checking');
  const [job, setJob] = useState<Job>({ state: 'idle' });

  const check = useCallback(async () => {
    setService('checking');
    setService((await exportServiceAvailable()) ? 'ready' : 'offline');
  }, []);
  useEffect(() => {
    void check();
  }, [check]);

  // Sections that fill whole sheets can be printed on their own (all of them in this template).
  const offered = useMemo(
    () => planExport(project, { profile: 'home-duplex' }).sections.filter((s) => s.wholeSheets),
    [project],
  );
  const selected = chosen ?? new Set(offered.map((s) => s.key));
  const everything = offered.every((s) => selected.has(s.key));
  const sections = everything
    ? undefined
    : offered.filter((s) => selected.has(s.key)).map((s) => s.key);
  const sectionsKey = sections?.join(',');
  const plan = useMemo(
    () => planExport(project, { profile, sections: sectionsKey?.split(',').filter(Boolean) }),
    [project, profile, sectionsKey],
  );
  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    setChosen(next);
  };
  const monthsOnly = () =>
    setChosen(new Set(offered.filter((s) => s.key.startsWith('month:')).map((s) => s.key)));

  const missing = useMemo(
    () => scanTranslations(project).missingByLocale[project.locale],
    [project],
  );
  const personal = Object.values(project.generation.variables).some((v) => v.personal);
  // Browser printing gets the same page ranges (1-based), e.g. "5-86,87-174".
  const ranges = plan.parts.map((p) => `${p.from + 1}-${p.to + 1}`).join(',');
  const fileLabel =
    sections && (sections.length === 1 ? sections[0] : `${sections[0]} ${sections.at(-1)}`);
  const sheets = profile === 'home-a5-2up' ? plan.pageCount / 4 : Math.ceil(plan.pageCount / 2);

  const run = async () => {
    setJob({ state: 'running', done: 0, total: plan.parts.length });
    try {
      const files = await exportPdf(
        project,
        { profile, sections, reverseBacks, samples },
        (done, total) => setJob({ state: 'running', done, total }),
      );
      const stem = `${fileStem(project.meta.name, fileLabel)}${samples ? `-${t('exampleSuffix')}` : ''}`;
      for (const f of files) downloadBytes(`${stem}${f.suffix}.pdf`, f.bytes);
      setJob({ state: 'done', files, stem });
      await getProjectRepository().recordExport(project.id, 'pdf', plan.pageCount);
    } catch (e) {
      if (e instanceof ExportError && e.reason === 'offline') setService('offline');
      setJob({
        state: 'error',
        message:
          e instanceof ExportError
            ? t(`error.${e.reason}`)
            : e instanceof Error
              ? e.message
              : String(e),
      });
    }
  };

  const calibration = async () => {
    // The paper that goes through the printer: A4 for 2-up, else the planner format.
    const paper = profile === 'home-a5-2up' ? PAGE_FORMATS.A4 : PAGE_FORMATS[project.format];
    const bytes = await calibrationPdf({
      width: paper.width,
      height: paper.height,
      labels: {
        title: t('calibration.title'),
        rulers: t('calibration.rulers'),
        front: t('calibration.front'),
        back: t('calibration.back'),
      },
    });
    downloadBytes(`calibration-${paper.width}x${paper.height}.pdf`, bytes);
  };

  const saveJson = async (kind: 'project' | 'template') => {
    const stem = fileStem(project.meta.name);
    if (kind === 'project') {
      downloadText(`${stem}.planner.json`, projectToJson(project), 'application/json');
      await getProjectRepository().recordExport(project.id, 'json');
    } else {
      downloadText(`${stem}.template.json`, templateToJson(project), 'application/json');
    }
  };

  const box = 'rounded border border-line bg-surface p-4';
  const heading = 'mb-3 text-base font-medium';
  const button = 'rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40';
  const secondary = 'rounded border border-line px-3 py-1.5 hover:bg-bg';
  const chip = 'rounded border border-line px-2 py-0.5 text-xs hover:bg-bg';

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface px-4 py-3 text-sm">
        <Link href="/" className="underline">
          {common('planners')}
        </Link>
        <h1 className="font-medium">
          {t('title')}: {project.meta.name}
        </h1>
        <nav className="ml-auto flex items-center gap-4">
          <Link href={`/editor?id=${project.id}`} className="underline">
            {t('designer')}
          </Link>
          <Link href={`/preview?id=${project.id}`} className="underline">
            {t('preview')}
          </Link>
          <LanguageSwitcher />
        </nav>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 p-6 text-sm lg:grid-cols-2">
        <section className={box} aria-labelledby={`${ids}-what`}>
          <h2 id={`${ids}-what`} className={heading}>
            {t('what')}
          </h2>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button type="button" className={chip} onClick={() => setChosen(null)}>
              {t('selectAll')}
            </button>
            <button type="button" className={chip} onClick={monthsOnly}>
              {t('selectMonths')}
            </button>
            <button type="button" className={chip} onClick={() => setChosen(new Set())}>
              {t('selectNone')}
            </button>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="sr-only">{t('what')}</legend>
            {offered.map((s) => (
              <label key={s.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(s.key)}
                  onChange={(e) => toggle(s.key, e.target.checked)}
                />
                {localize(s.title, project.locale) || s.key}
                <span className="text-xs text-ink-muted">
                  {t('pageRange', { from: s.from + 1, to: s.to + 1 })}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="mt-3 text-xs text-ink-muted">{t('ringHint')}</p>
        </section>

        <section className={box} aria-labelledby={`${ids}-how`}>
          <h2 id={`${ids}-how`} className={heading}>
            {t('how')}
          </h2>
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{t('how')}</legend>
            {profiles.map((p) => (
              <label key={p} className="flex gap-2">
                <input
                  type="radio"
                  name={`${ids}-profile`}
                  checked={profile === p}
                  onChange={() => setProfile(p)}
                />
                <span>
                  <span className="font-medium">{t(`profile.${p}.name`)}</span>
                  <span className="block text-xs text-ink-muted">{t(`profile.${p}.hint`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {profile === 'home-manual-duplex' && (
            <label className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={reverseBacks}
                onChange={(e) => setReverseBacks(e.target.checked)}
              />
              {t('reverseBacks')}
            </label>
          )}
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={project.print.pageNumbers}
              onChange={(e) =>
                onChange({ ...project, print: { ...project.print, pageNumbers: e.target.checked } })
              }
            />
            {t('pageNumbers')}
          </label>
          <label className="mt-3 flex gap-2">
            <input
              type="checkbox"
              checked={samples}
              onChange={(e) => setSamples(e.target.checked)}
            />
            <span>
              {t('samples')}
              <span className="block text-xs text-ink-muted">{t('samplesHint')}</span>
            </span>
          </label>
          <Link href="/guide" className="mt-3 inline-block underline">
            {t('guideLink')}
          </Link>
        </section>

        <section className={`${box} lg:col-span-2`} aria-labelledby={`${ids}-check`}>
          <h2 id={`${ids}-check`} className={heading}>
            {t('before')}
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              {t('summary', {
                pages: plan.pageCount,
                sheets,
                format: project.format,
                language: common(`languages.${project.locale}`),
              })}
            </li>
            {missing > 0 && (
              <li className="text-danger">
                {t('missingTranslations', { count: missing })}{' '}
                <Link href={`/translations?id=${project.id}`} className="underline">
                  {t('fixTranslations')}
                </Link>
              </li>
            )}
            {personal && <li>{t('personal')}</li>}
            <li>{t('actualSize')}</li>
            <li>{t(`instructions.${profile}`)}</li>
            <li>
              {t('calibrationHint')}{' '}
              <button type="button" className="underline" onClick={() => void calibration()}>
                {t('calibrationDownload')}
              </button>
            </li>
          </ul>
        </section>

        <section className={`${box} lg:col-span-2`} aria-labelledby={`${ids}-pdf`}>
          <h2 id={`${ids}-pdf`} className={heading}>
            {t('pdf')}
          </h2>
          {service === 'offline' ? (
            <div className="flex flex-col gap-2">
              {usesLocalExportService() ? (
                <>
                  <p>{t('serviceOffline')}</p>
                  <pre className="overflow-x-auto rounded bg-bg p-2 text-xs">
                    pnpm --filter @planner/export-node dev
                  </pre>
                  <p className="text-xs text-ink-muted">
                    {t('serviceUrl', { url: exportServiceUrl() })}
                  </p>
                </>
              ) : (
                <p>{t('hostedUnavailable')}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondary} onClick={() => void check()}>
                  {t('checkAgain')}
                </button>
                <Link
                  href={`/print?id=${project.id}&ranges=${ranges}${samples ? '&samples=1' : ''}`}
                  className={secondary}
                >
                  {t('browserPrint')}
                </Link>
              </div>
              <p className="text-xs text-ink-muted">{t('browserPrintHint')}</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={button}
                disabled={service !== 'ready' || job.state === 'running' || plan.parts.length === 0}
                onClick={() => void run()}
              >
                {t('createPdf')}
              </button>
              <span role="status" aria-live="polite" className="text-ink-muted">
                {service === 'checking' && t('checking')}
                {service === 'ready' && plan.parts.length === 0 && t('nothingSelected')}
                {job.state === 'running' && t('progress', { done: job.done, total: job.total })}
                {job.state === 'done' && t('done')}
              </span>
            </div>
          )}
          {job.state === 'error' && (
            <p role="alert" className="mt-2 text-danger">
              {job.message}
            </p>
          )}
          {job.state === 'done' && (
            <ul className="mt-3 flex flex-col gap-1">
              {job.files.map((f) => (
                <li key={f.suffix}>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => downloadBytes(`${job.stem}${f.suffix}.pdf`, f.bytes)}
                  >
                    {`${job.stem}${f.suffix}.pdf`}
                  </button>{' '}
                  <span className="text-xs text-ink-muted">
                    {t('fileInfo', { pages: f.pageCount, size: Math.round(f.bytes.length / 1024) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${box} lg:col-span-2`} aria-labelledby={`${ids}-json`}>
          <h2 id={`${ids}-json`} className={heading}>
            {t('json')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={() => void saveJson('project')}>
              {t('saveProject')}
            </button>
            <button type="button" className={secondary} onClick={() => void saveJson('template')}>
              {t('saveTemplate')}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">{t('jsonHint')}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {t('templateName', { name: localize(project.template.name, uiLocale) })}
          </p>
        </section>
      </main>
    </div>
  );
}
