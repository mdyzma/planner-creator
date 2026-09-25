'use client';

import { resolveFrame, sideOfIndex } from '@planner/core';
import { PageView, PrintDocument } from '@planner/renderer';
import type { PlannerProject } from '@planner/schema';
import { PAGE_FORMATS } from '@planner/schema';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ProjectStatus } from '@/components/ProjectStatus';
import { Link } from '@/i18n/navigation';
import type { ExportPayload } from '@/lib/exportPayload';
import { EXPORT_READY_ATTRIBUTE, exportPayload } from '@/lib/exportPayload';
import { FILLER_PATTERN, blockRegistry, layoutProject } from '@/lib/pages';
import { useProject } from '@/lib/useProject';

/**
 * Pages in print mode, sized with @page. In the browser it prints the planner, or the page ranges
 * in `?ranges=5-86,175-246` (or `?from=&to=`, 1-based); the export service loads the same route
 * with the project injected and turns it into PDF (§8.3).
 */
export function PrintScreen() {
  // Decided after hydration: the static HTML never contains an injected project.
  const [payload, setPayload] = useState<ExportPayload | null | undefined>(undefined);
  useEffect(() => setPayload(exportPayload() ?? null), []);
  if (payload === undefined) return null;
  return payload ? <ExportPrint payload={payload} /> : <BrowserPrint />;
}

function ExportPrint({ payload }: { payload: ExportPayload }) {
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) document.documentElement.setAttribute(EXPORT_READY_ATTRIBUTE, 'true');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const { project, from, to, padAfter } = payload;
  return <PrintPages project={project} ranges={[{ from, to }]} padAfter={padAfter} />;
}

function BrowserPrint() {
  const t = useTranslations('Print');
  const params = useSearchParams();
  const { state } = useProject(params.get('id'));
  const project = state.status === 'ready' ? state.project : undefined;
  const count = useMemo(() => (project ? layoutProject(project).pages.length : 0), [project]);

  if (state.status === 'loading') return null;
  if (!project) {
    return (
      <ProjectStatus
        status={state.status === 'error' ? 'error' : 'missing'}
        message={state.status === 'error' ? state.message : undefined}
      />
    );
  }

  const clamp = (n: number) => Math.min(count, Math.max(1, n));
  const ranges = (
    params.get('ranges')
      ? params
          .get('ranges')!
          .split(',')
          .map((r) => r.split('-').map(Number))
      : [[Number(params.get('from')) || 1, Number(params.get('to')) || count]]
  )
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))
    .map(([a, b]) => ({ from: clamp(a!) - 1, to: clamp(b!) - 1 }))
    .filter((r) => r.to >= r.from);
  const total = ranges.reduce((n, r) => n + r.to - r.from + 1, 0);

  return (
    <>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 py-3 text-sm">
        <Link href={`/export?id=${project.id}`} className="underline">
          {t('back')}
        </Link>
        <span>
          {t.rich('instructions', {
            pages: total,
            format: project.format,
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded bg-accent px-4 py-2 font-medium text-accent-ink"
        >
          {t('print')}
        </button>
      </div>
      <div className="print-stack">
        <PrintPages project={project} ranges={ranges} padAfter={0} />
      </div>
    </>
  );
}

/** Printed pages in the given ranges (0-based, inclusive), then `padAfter` blank notes pages. */
function PrintPages({
  project,
  ranges,
  padAfter,
}: {
  project: PlannerProject;
  ranges: readonly { from: number; to: number }[];
  padAfter: number;
}) {
  const layout = useMemo(() => layoutProject(project), [project]);
  const { width, height } = PAGE_FORMATS[project.format];
  const bleed = project.print.bleed;
  const pages = ranges.flatMap((r) => layout.pages.slice(r.from, r.to + 1));
  const last = ranges.at(-1)?.to ?? -1;
  const pads = Array.from({ length: padAfter }, (_, i) => {
    const side = sideOfIndex(last + 1 + i);
    return { key: `pad-${i}`, frame: resolveFrame(project.format, project.print, side) };
  });

  return (
    <div lang={project.locale}>
      <PrintDocument width={width + 2 * bleed} height={height + 2 * bleed}>
        {pages.map((p) => (
          <PageView
            key={p.page.index}
            frame={p.frame}
            template={p.template}
            fillerPattern={FILLER_PATTERN}
            renderBlock={blockRegistry.render}
            pageContext={p.page.instance?.context}
            vars={p.vars}
            range={layout.range}
            contentFor={p.contentFor}
            locale={project.locale}
            grammaticalGender={project.i18nOptions.grammaticalGender}
            mode="print"
            pageNumber={project.print.pageNumbers && !p.page.filler ? p.page.number : undefined}
          />
        ))}
        {pads.map((p) => (
          <PageView
            key={p.key}
            frame={p.frame}
            fillerPattern={FILLER_PATTERN}
            locale={project.locale}
            mode="print"
          />
        ))}
      </PrintDocument>
    </div>
  );
}
