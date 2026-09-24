'use client';

import { PageView, PrintDocument } from '@planner/renderer';
import { PAGE_FORMATS } from '@planner/schema';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { FILLER_PATTERN, layoutProject } from '@/lib/pages';
import { useProject } from '@/lib/useProject';

/**
 * Every page in print mode, sized with @page. Browser print works now; the export service (M7)
 * renders this same route to PDF.
 */
export function PrintScreen() {
  const id = useSearchParams().get('id');
  const { state } = useProject(id);
  const project = state.status === 'ready' ? state.project : undefined;
  const layout = useMemo(() => (project ? layoutProject(project) : undefined), [project]);

  if (state.status === 'loading') return null;
  if (!project || !layout) {
    return (
      <p className="p-6">
        Planner not found.{' '}
        <Link className="underline" href="/">
          Back to your planners
        </Link>
      </p>
    );
  }

  const { width, height } = PAGE_FORMATS[project.format];
  const bleed = project.print.bleed;

  return (
    <>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 py-3 text-sm">
        <Link href={`/preview?id=${project.id}`} className="underline">
          ← Preview
        </Link>
        <span>
          {layout.pages.length} pages · {project.format}. In the print dialog choose{' '}
          <strong>Actual size / 100 %</strong>, no margins, and turn headers and footers off.
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded bg-accent px-4 py-2 font-medium text-accent-ink"
        >
          Print / Save as PDF
        </button>
      </div>
      <div className="print-stack">
        <PrintDocument width={width + 2 * bleed} height={height + 2 * bleed}>
          {layout.pages.map((p) => (
            <PageView
              key={p.page.index}
              frame={p.frame}
              template={p.template}
              fillerPattern={FILLER_PATTERN}
              locale={project.locale}
              mode="print"
              pageNumber={project.print.pageNumbers && !p.page.filler ? p.page.number : undefined}
            />
          ))}
        </PrintDocument>
      </div>
    </>
  );
}
