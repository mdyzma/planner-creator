'use client';

import { applyGender, localize } from '@planner/i18n';
import { PageView } from '@planner/renderer';
import type { FormatId, Locale, PageRef, PlannerProject, SectionTemplate } from '@planner/schema';
import { FORMAT_IDS } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { createGeneratedProject } from '@/lib/newProject';
import type { RenderedPage } from '@/lib/pages';
import { FILLER_PATTERN, blockRegistry, layoutProject } from '@/lib/pages';
import { BUNDLED_TEMPLATES } from '@/lib/templates';

/**
 * The printed guide (one language per file): each kind of page, filled in with grey handwritten
 * examples and notes, next to an explanation of what to write there and why. Built from the
 * bundled template and a one-month example planner, so it never touches the user's planners.
 */

/** Guide chapters: page templates shown together (a spread is two templates side by side). */
const CHAPTERS: { key: string; pages: string[][] }[] = [
  { key: 'intro', pages: [['cover'], ['how-to'], ['contract'], ['safety-rules']] },
  { key: 'month', pages: [['month-divider'], ['month-open-left', 'month-open-right']] },
  { key: 'week', pages: [['week-left', 'week-right']] },
  { key: 'day', pages: [['day-left', 'day-right'], ['situation']] },
  { key: 'monthEnd', pages: [['wheel-of-life'], ['monthly-review'], ['notes']] },
  {
    key: 'crisis',
    pages: [
      ['sos'],
      ['warning-signs-left', 'warning-signs-right'],
      ['gains-losses'],
      ['support-network'],
    ],
  },
];

/** Usable width of an A4 guide page (210 mm minus 15 mm margins). */
const CONTENT_WIDTH = 180;

/** Optional pages are switched on in the example planner, so the guide explains them too. */
const withOptionalPages = (
  entries: Array<SectionTemplate | PageRef>,
): Array<SectionTemplate | PageRef> =>
  entries.map((e) =>
    'page' in e ? { ...e, enabled: true } : { ...e, children: withOptionalPages(e.children) },
  );

function exampleProject(locale: Locale, format: FormatId): PlannerProject {
  const bundled = BUNDLED_TEMPLATES[0]!;
  const bundle = {
    ...bundled,
    template: {
      ...bundled.template,
      sections: withOptionalPages(bundled.template.sections) as SectionTemplate[],
    },
  };
  const { project } = createGeneratedProject({
    bundle,
    id: 'guide-example',
    name: 'Guide',
    format,
    locale,
    now: '2026-09-25T00:00:00.000Z',
    // A month that starts mid-week, so the calendars show greyed days of both neighbours.
    startDate: '2026-10-01',
    durationMonths: 1,
  });
  return project;
}

export function GuideScreen() {
  const t = useTranslations('Guide');
  const common = useTranslations('Common');
  const locale = useLocale() as Locale;
  const [format, setFormat] = useState<FormatId>('A4');

  const project = useMemo(() => exampleProject(locale, format), [locale, format]);
  const layout = useMemo(() => layoutProject(project), [project]);
  // The first page of each kind whose dates all fall inside the planner (so a week that starts
  // before the planner, with faded days, is not the one shown).
  const inRange = (p: RenderedPage) => {
    const { date, dates } = p.page.instance?.context ?? {};
    const range = layout.range;
    return (
      !range ||
      [...(date ? [date] : []), ...(dates ?? [])].every((d) => d >= range.start && d <= range.end)
    );
  };
  const firstOf = (templateId: string) => {
    const pages = layout.pages.filter((p) => p.page.instance?.templateId === templateId);
    return pages.find(inRange) ?? pages[0];
  };
  const gender = project.i18nOptions.grammaticalGender;
  const guideText = (p: RenderedPage | undefined) =>
    p?.template?.guide ? applyGender(localize(p.template.guide, locale), gender) : '';

  const renderPage = (p: RenderedPage, scale: number) => (
    <div
      key={p.page.index}
      style={{
        width: `${p.frame.trim.w * scale}mm`,
        height: `${p.frame.trim.h * scale}mm`,
        overflow: 'hidden',
        boxShadow: '0 0 0 0.2mm #b9b9b9',
        background: '#fff',
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <PageView
          frame={p.frame}
          template={p.template}
          fillerPattern={FILLER_PATTERN}
          renderBlock={blockRegistry.render}
          pageContext={p.page.instance?.context}
          vars={p.vars}
          range={layout.range}
          contentFor={p.contentFor}
          locale={locale}
          grammaticalGender={gender}
          mode="print"
          samples
        />
      </div>
    </div>
  );

  return (
    <>
      <style>{`
@page { size: 210mm 297mm; margin: 0; }
@media print {
  html, body { margin: 0 !important; background: #fff !important; }
  .no-print { display: none !important; }
  .guide-page { box-shadow: none !important; margin: 0 !important; }
}
.guide-page { break-after: page; }
.guide-page:last-child { break-after: auto; }
`}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 py-3 text-sm">
        <Link href="/" className="underline">
          {common('planners')}
        </Link>
        <span className="font-medium">{t('title')}</span>
        <label className="flex items-center gap-2">
          {t('format')}
          <select
            className="rounded border border-line bg-surface px-2 py-1"
            value={format}
            onChange={(e) => setFormat(e.target.value as FormatId)}
          >
            {FORMAT_IDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <span className="text-ink-muted">{t('printHint')}</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-accent px-4 py-2 font-medium text-accent-ink"
        >
          {t('print')}
        </button>
        <span className="ml-auto">
          <LanguageSwitcher />
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-8 bg-bg py-8 print:block print:bg-white print:p-0"
        lang={locale}
      >
        <GuidePage>
          <div className="flex h-full flex-col justify-center gap-6">
            <h1 className="text-3xl font-semibold">{t('title')}</h1>
            <p className="text-lg">{localize(project.template.name, locale)}</p>
            <p className="leading-relaxed">{t('intro')}</p>
            <p className="leading-relaxed">
              {t.rich('legend', {
                hand: (chunks) => (
                  <span
                    style={{
                      fontFamily: 'var(--planner-hand), cursive',
                      fontSize: '15pt',
                      color: '#5f666d',
                    }}
                  >
                    {chunks}
                  </span>
                ),
                note: (chunks) => (
                  <span
                    style={{
                      fontFamily: 'var(--planner-hand), cursive',
                      fontSize: '14pt',
                      color: '#8a9096',
                    }}
                  >
                    {chunks}
                  </span>
                ),
              })}
            </p>
            <ol className="list-decimal pl-6 leading-relaxed">
              {CHAPTERS.map((c) => (
                <li key={c.key}>{t(`chapter.${c.key as 'intro'}`)}</li>
              ))}
            </ol>
          </div>
        </GuidePage>

        {CHAPTERS.flatMap((chapter) =>
          chapter.pages.map((group, i) => {
            const pages = group.map(firstOf).filter((p): p is RenderedPage => Boolean(p));
            if (pages.length === 0) return null;
            const spread = pages.length > 1;
            const pageWidth = pages[0]!.frame.trim.w;
            // A spread fills the width; a single page is shown large with the text below.
            const scale = spread
              ? CONTENT_WIDTH / (pageWidth * 2 + 2)
              : Math.min(0.62, 175 / pages[0]!.frame.trim.h);
            return (
              <GuidePage key={`${chapter.key}-${i}`}>
                {i === 0 && (
                  <p className="text-sm uppercase tracking-wide text-ink-muted print:text-[#555]">
                    {t(`chapter.${chapter.key as 'intro'}`)}
                  </p>
                )}
                <h2 className="mb-3 text-xl font-semibold">
                  {pages.map((p) => localize(p.template?.name, locale)).join(' · ')}
                </h2>
                <div className="mb-4 flex flex-col gap-2 leading-relaxed">
                  {pages
                    .map(guideText)
                    .filter((text, j, all) => text && all.indexOf(text) === j)
                    .map((text) => (
                      <p key={text}>{text}</p>
                    ))}
                </div>
                <div className="flex justify-center gap-[2mm]">
                  {pages.map((p) => renderPage(p, scale))}
                </div>
              </GuidePage>
            );
          }),
        )}
      </div>
    </>
  );
}

/** One A4 page of the guide, with 15 mm margins. */
function GuidePage({ children }: { children: ReactNode }) {
  return (
    <section
      className="guide-page bg-white text-[#1e2424] shadow-lg"
      style={{
        width: '210mm',
        height: '297mm',
        padding: '15mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--planner-font), sans-serif',
        fontSize: '10.5pt',
      }}
    >
      {children}
    </section>
  );
}
