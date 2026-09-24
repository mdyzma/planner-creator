'use client';

import { localize, toSpreads, withFormat } from '@planner/core';
import { PageView, SpreadView } from '@planner/renderer';
import type { FormatId, Locale, PlannerProject } from '@planner/schema';
import { FORMAT_IDS, LOCALES } from '@planner/schema';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { FILLER_PATTERN, layoutProject, type RenderedPage } from '@/lib/pages';
import { useProject } from '@/lib/useProject';

type ViewMode = 'spread' | 'single';
const ZOOMS = [0.5, 0.75, 1] as const;

export function PreviewScreen() {
  const id = useSearchParams().get('id');
  const { state, save } = useProject(id);

  if (state.status === 'loading') return <p className="p-6 text-ink-muted">Loading…</p>;
  if (state.status === 'missing') {
    return (
      <p className="p-6">
        Planner not found.{' '}
        <Link className="underline" href="/">
          Back to your planners
        </Link>
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="p-6 text-danger">
        {state.message}
      </p>
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
  const [view, setView] = useState<ViewMode>('spread');
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(0.5);
  const [guides, setGuides] = useState(true);

  const { pages, paginationWarnings, frameWarnings } = useMemo(
    () => layoutProject(project),
    [project],
  );
  const fillers = pages.filter((p) => p.page.filler).length;

  const renderPage = (p: RenderedPage) => (
    <figure key={p.page.index} className="m-0 flex flex-col items-center gap-1">
      <PageView
        frame={p.frame}
        template={p.template}
        fillerPattern={FILLER_PATTERN}
        locale={project.locale}
        mode="preview"
        showGuides={guides}
        printerSafeMargin={project.print.printerSafeMargin}
        pageNumber={project.print.pageNumbers && !p.page.filler ? p.page.number : undefined}
        label={`Page ${p.page.number}, ${p.page.side}`}
      />
      <figcaption className="text-center text-ink-muted" style={{ fontSize: `${12 / zoom}px` }}>
        {p.page.number} · {p.page.side} ·{' '}
        {p.template ? localize(p.template.name, project.locale) : `filler (${p.page.filler})`}
      </figcaption>
    </figure>
  );

  const blank = (p: RenderedPage | undefined) => (
    <div aria-hidden="true" style={{ width: `${p ? p.frame.trim.w : 0}mm` }} />
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3">
        <Link href="/" className="text-sm underline">
          ← Planners
        </Link>
        <h1 className="font-medium">{project.meta.name}</h1>
        <Segmented
          label="View"
          value={view}
          options={[
            ['spread', 'Spreads'],
            ['single', 'Single pages'],
          ]}
          onChange={setView}
        />
        <Segmented
          label="Format"
          value={project.format}
          options={FORMAT_IDS.map((f) => [f, f] as const)}
          onChange={(f: FormatId) => onChange(withFormat(project, f))}
        />
        <Segmented
          label="Language"
          value={project.locale}
          options={LOCALES.map((l) => [l, l.toUpperCase()] as const)}
          onChange={(locale: Locale) => onChange({ ...project, locale })}
        />
        <label className="flex items-center gap-2 text-sm">
          Zoom
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
          Binding & margin guides
        </label>
        <Link href={`/print?id=${project.id}`} className="ml-auto text-sm underline">
          Print view
        </Link>
      </header>

      <p className="px-4 py-2 text-sm text-ink-muted" aria-live="polite">
        {pages.length} pages ({fillers} filler) · {project.format} · margins inner{' '}
        {project.print.margins.inner} / outer {project.print.margins.outer} mm · print profile{' '}
        {project.print.profile}
        {[
          ...paginationWarnings.map((w) => `unknown template ${w.templateId}`),
          ...frameWarnings.map((w) => `${w.margin} margin raised to ${w.appliedMm} mm (${w.code})`),
        ].map((w) => (
          <span key={w} className="ml-3 text-danger">
            ⚠ {w}
          </span>
        ))}
      </p>

      <main className="flex-1 overflow-auto bg-bg">
        <div className="flex flex-col items-center-safe gap-10 p-8" style={{ zoom }}>
          {view === 'single'
            ? pages.map(renderPage)
            : toSpreads(pages.map((p) => p.page)).map((s, i) => {
                const left = s.left && pages[s.left.index];
                const right = s.right && pages[s.right.index];
                return (
                  <section
                    key={i}
                    aria-label={`Spread ${[s.left?.number, s.right?.number].filter(Boolean).join('–')}`}
                    className="shadow-lg"
                  >
                    <SpreadView
                      left={left ? renderPage(left) : blank(right)}
                      right={right ? renderPage(right) : blank(left)}
                    />
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
