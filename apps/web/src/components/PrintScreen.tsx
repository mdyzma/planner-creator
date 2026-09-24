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
 * Pages in print mode, sized with @page. In the browser it prints the planner (or the page range
 * in `?from=&to=`, 1-based); the export service loads the same route with the project injected
 * and turns it into PDF (§8.3).
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
  return <PrintPages {...payload} />;
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

  const from = Math.max(1, Number(params.get('from')) || 1);
  const to = Math.min(count, Number(params.get('to')) || count);

  return (
    <>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 py-3 text-sm">
        <Link href={`/export?id=${project.id}`} className="underline">
          {t('back')}
        </Link>
        <span>
          {t.rich('instructions', {
            pages: to - from + 1,
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
        <PrintPages project={project} from={from - 1} to={to - 1} padAfter={0} />
      </div>
    </>
  );
}

/** Printed pages `from`…`to` (0-based) and `padAfter` blank notes pages. */
function PrintPages({
  project,
  from,
  to,
  padAfter,
}: {
  project: PlannerProject;
  from: number;
  to: number;
  padAfter: number;
}) {
  const layout = useMemo(() => layoutProject(project), [project]);
  const { width, height } = PAGE_FORMATS[project.format];
  const bleed = project.print.bleed;
  const pages = layout.pages.slice(from, to + 1);
  const pads = Array.from({ length: padAfter }, (_, i) => {
    const side = sideOfIndex(to + 1 + i);
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
