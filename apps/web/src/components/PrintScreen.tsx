'use client';

import { PageView, PrintDocument } from '@planner/renderer';
import { PAGE_FORMATS } from '@planner/schema';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { ProjectStatus } from '@/components/ProjectStatus';
import { Link } from '@/i18n/navigation';
import { FILLER_PATTERN, blockRegistry, layoutProject } from '@/lib/pages';
import { useProject } from '@/lib/useProject';

/**
 * Every page in print mode, sized with @page. Browser print works now; the export service (M7)
 * renders this same route to PDF.
 */
export function PrintScreen() {
  const t = useTranslations('Print');
  const id = useSearchParams().get('id');
  const { state } = useProject(id);
  const project = state.status === 'ready' ? state.project : undefined;
  const layout = useMemo(() => (project ? layoutProject(project) : undefined), [project]);

  if (state.status === 'loading') return null;
  if (!project || !layout) {
    return (
      <ProjectStatus
        status={state.status === 'error' ? 'error' : 'missing'}
        message={state.status === 'error' ? state.message : undefined}
      />
    );
  }

  const { width, height } = PAGE_FORMATS[project.format];
  const bleed = project.print.bleed;

  return (
    <>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 py-3 text-sm">
        <Link href={`/preview?id=${project.id}`} className="underline">
          {t('back')}
        </Link>
        <span>
          {t.rich('instructions', {
            pages: layout.pages.length,
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
      <div className="print-stack" lang={project.locale}>
        <PrintDocument width={width + 2 * bleed} height={height + 2 * bleed}>
          {layout.pages.map((p) => (
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
        </PrintDocument>
      </div>
    </>
  );
}
