'use client';

import { toSpreads, withFormat } from '@planner/core';
import { regenerate } from '@planner/generator';
import { formatDate, localize } from '@planner/i18n';
import { PageView, SpreadView } from '@planner/renderer';
import type { FormatId, Locale, PlannerProject } from '@planner/schema';
import { FORMAT_IDS, LOCALES } from '@planner/schema';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LazyVisible } from '@/components/LazyVisible';
import { ProjectStatus } from '@/components/ProjectStatus';
import { Link } from '@/i18n/navigation';
import { FILLER_PATTERN, blockRegistry, layoutProject, type RenderedPage } from '@/lib/pages';
import { useProject } from '@/lib/useProject';

type ViewMode = 'spread' | 'single';
const ZOOMS = [0.5, 0.75, 1] as const;

export function PreviewScreen() {
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
  return <Preview project={state.project} onChange={save} />;
}

function Preview({
  project,
  onChange,
}: {
  project: PlannerProject;
  onChange: (p: PlannerProject) => void;
}) {
  const t = useTranslations('Preview');
  const common = useTranslations('Common');
  const [view, setView] = useState<ViewMode>('spread');
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(0.5);
  const [guides, setGuides] = useState(true);

  const { pages, range, paginationWarnings, frameWarnings } = useMemo(
    () => layoutProject(project),
    [project],
  );
  const fillers = pages.filter((p) => p.page.filler).length;
  const plannerLocale = project.locale;

  const caption = (p: RenderedPage) => {
    if (!p.template) return t('filler', { reason: t(`fillerReason.${p.page.filler ?? 'pad'}`) });
    const name = localize(p.template.name, plannerLocale);
    const date = p.page.instance?.context.date;
    return date ? `${name} · ${formatDate(date, plannerLocale, 'weekday-day-month')}` : name;
  };

  const renderPage = (p: RenderedPage) => (
    <figure key={p.page.index} className="m-0 flex flex-col items-center gap-1">
      <PageView
        frame={p.frame}
        template={p.template}
        fillerPattern={FILLER_PATTERN}
        renderBlock={blockRegistry.render}
        pageContext={p.page.instance?.context}
        vars={p.vars}
        range={range}
        contentFor={p.contentFor}
        locale={plannerLocale}
        grammaticalGender={project.i18nOptions.grammaticalGender}
        mode="preview"
        showGuides={guides}
        printerSafeMargin={project.print.printerSafeMargin}
        pageNumber={project.print.pageNumbers && !p.page.filler ? p.page.number : undefined}
        label={t('pageLabel', { number: p.page.number, side: t(`side.${p.page.side}`) })}
      />
      <figcaption className="text-center text-ink-muted" style={{ fontSize: `${12 / zoom}px` }}>
        {p.page.number} · {t(`side.${p.page.side}`)} · {caption(p)}
      </figcaption>
    </figure>
  );

  const blank = (p: RenderedPage | undefined) => (
    <div aria-hidden="true" style={{ width: `${p ? p.frame.trim.w : 0}mm` }} />
  );

  const warnings = [
    ...paginationWarnings.map((w) => t('unknownTemplate', { id: w.templateId })),
    ...frameWarnings.map((w) =>
      t('marginRaised', { margin: t(`margin.${w.margin}`), mm: w.appliedMm }),
    ),
  ];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3">
        <Link href="/" className="text-sm underline">
          {common('planners')}
        </Link>
        <h1 className="font-medium">{project.meta.name}</h1>
        <Segmented
          label={t('view')}
          value={view}
          options={[
            ['spread', t('spreads')],
            ['single', t('singlePages')],
          ]}
          onChange={setView}
        />
        <Segmented
          label={t('format')}
          value={project.format}
          options={FORMAT_IDS.map((f) => [f, f] as const)}
          onChange={(f: FormatId) => onChange(withFormat(project, f))}
        />
        <Segmented
          label={t('plannerLanguage')}
          value={plannerLocale}
          options={LOCALES.map((l) => [l, l.toUpperCase()] as const)}
          onChange={(locale: Locale) => onChange({ ...project, locale })}
        />
        <label className="flex items-center gap-2 text-sm">
          {t('zoom')}
          <select
            className="rounded border border-line bg-surface px-2 py-1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value) as (typeof ZOOMS)[number])}
          >
            {ZOOMS.map((z) => (
              <option key={z} value={z}>
                {z * 100}%
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
          {t('guides')}
        </label>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link href={`/translations?id=${project.id}`} className="underline">
            {t('translations')}
          </Link>
          <Link href={`/content?id=${project.id}`} className="underline">
            {t('content')}
          </Link>
          <Link href={`/print?id=${project.id}`} className="underline">
            {t('printView')}
          </Link>
          <LanguageSwitcher />
        </nav>
      </header>

      {project.template.sections.length > 0 && <DatesBar project={project} onChange={onChange} />}

      <p className="px-4 py-2 text-sm text-ink-muted" aria-live="polite">
        {t('summary', {
          pages: pages.length,
          fillers,
          format: project.format,
          inner: project.print.margins.inner,
          outer: project.print.margins.outer,
          profile: project.print.profile,
        })}
        {warnings.map((w) => (
          <span key={w} className="ml-3 text-danger">
            ⚠ {w}
          </span>
        ))}
      </p>

      <main className="flex-1 overflow-auto bg-bg" lang={plannerLocale}>
        <div className="flex flex-col items-center-safe gap-10 p-8" style={{ zoom }}>
          {view === 'single'
            ? pages.map((p) => (
                <LazyVisible
                  key={p.page.index}
                  widthMm={p.frame.trim.w}
                  heightMm={p.frame.trim.h + 8}
                >
                  {renderPage(p)}
                </LazyVisible>
              ))
            : toSpreads(pages.map((p) => p.page)).map((s, i) => {
                const left = s.left && pages[s.left.index];
                const right = s.right && pages[s.right.index];
                const trim = (left ?? right)!.frame.trim;
                return (
                  <section
                    key={i}
                    aria-label={t('spreadLabel', {
                      pages: [s.left?.number, s.right?.number].filter(Boolean).join('–'),
                    })}
                    className="shadow-lg"
                  >
                    <LazyVisible widthMm={trim.w * 2} heightMm={trim.h + 8}>
                      <SpreadView
                        left={left ? renderPage(left) : blank(right)}
                        right={right ? renderPage(right) : blank(left)}
                      />
                    </LazyVisible>
                  </section>
                );
              })}
        </div>
      </main>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, ReactNode]>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex items-center gap-2 text-sm">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true">{label}</span>
      <div className="flex overflow-hidden rounded border border-line">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onChange(v)}
            className={`px-2.5 py-1 ${v === value ? 'bg-accent text-accent-ink' : 'bg-surface hover:bg-bg'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Start date and length for a generated planner. Applying them regenerates the pages and keeps
 * edits on every page whose date still exists (ADR-0003); the rest are reported.
 */
function DatesBar({
  project,
  onChange,
}: {
  project: PlannerProject;
  onChange: (p: PlannerProject) => void;
}) {
  const t = useTranslations('Preview');
  const d = useTranslations('Dashboard');
  const ids = useId();
  const [startDate, setStartDate] = useState(project.generation.startDate ?? '');
  const [months, setMonths] = useState(project.generation.durationMonths);
  const [message, setMessage] = useState<string | null>(null);

  const changed =
    (startDate || undefined) !== project.generation.startDate ||
    months !== project.generation.durationMonths;

  const apply = () => {
    const result = regenerate({
      ...project,
      generation: {
        ...project.generation,
        startDate: startDate || undefined,
        durationMonths: months,
      },
    });
    onChange(result.project);
    setMessage(
      [
        t('regenerated', { pages: result.budget.total }),
        result.orphans.length > 0 ? t('orphans', { count: result.orphans.length }) : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  };

  const field = 'rounded border border-line bg-surface px-2 py-1';
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 py-2 text-sm">
      <label className="flex items-center gap-2" htmlFor={`${ids}-start`}>
        {t('startDate')}
      </label>
      <input
        id={`${ids}-start`}
        type="date"
        className={field}
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />
      <label className="flex items-center gap-2">
        {t('length')}
        <select
          className={field}
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {d('months', { count: m })}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!changed}
        onClick={apply}
        className="rounded bg-accent px-3 py-1 font-medium text-accent-ink disabled:opacity-40"
      >
        {t('regenerate')}
      </button>
      {message && (
        <span role="status" className="text-ink-muted">
          {message}
        </span>
      )}
    </div>
  );
}
