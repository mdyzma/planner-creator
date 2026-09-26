'use client';

import { BrandMark } from '@planner/renderer';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { Icon } from './Icon';
import { LanguageSwitcher } from './LanguageSwitcher';

export type PlannerScreen = 'editor' | 'preview' | 'content' | 'translations' | 'export';

const TABS = ['editor', 'preview', 'content', 'translations'] as const;

export const iconButton =
  'inline-flex h-8 w-8 items-center justify-center rounded border border-line hover:bg-bg disabled:opacity-40 disabled:hover:bg-transparent';

/**
 * The bar at the top of every planner screen: the YAPCO mark (back to the planners), the planner (with the
 * screen's own items, such as undo), the screens as tabs, the interface language, and Export
 * as the one main action. One fixed height, so nothing below it moves.
 */
export function AppBar({
  projectId,
  screen,
  title,
  children,
}: {
  projectId: string;
  screen: PlannerScreen;
  title: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslations('Common');
  const href = (s: PlannerScreen) => `/${s}?id=${projectId}`;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 text-sm">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded px-1.5 py-1 hover:bg-bg"
        aria-label={t('backToPlanners')}
        title={t('backToPlanners')}
      >
        {/* The line apple from the title page and the printed page numbers. */}
        <BrandMark heightMm={6} color="currentColor" />
        <span className="font-semibold tracking-wide">YAPCO</span>
      </Link>
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 truncate font-medium">{title}</div>
        {children}
      </div>
      <nav
        aria-label={t('screens.label')}
        className="flex shrink-0 overflow-hidden rounded border border-line"
      >
        {TABS.map((s) => (
          <Link
            key={s}
            href={href(s)}
            aria-current={s === screen ? 'page' : undefined}
            className={`border-line px-3 py-1 [&:not(:first-child)]:border-l ${
              s === screen ? 'bg-bg font-medium' : 'text-ink-muted hover:bg-bg hover:text-ink'
            }`}
          >
            {t(`screens.${s}`)}
          </Link>
        ))}
      </nav>
      <div className="flex flex-1 items-center justify-end gap-3">
        <LanguageSwitcher compact />
        <Link
          href={href('export')}
          aria-current={screen === 'export' ? 'page' : undefined}
          className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 font-medium text-accent-ink hover:opacity-90 aria-[current=page]:ring-2 aria-[current=page]:ring-accent aria-[current=page]:ring-offset-2 aria-[current=page]:ring-offset-surface"
        >
          <Icon name="download" />
          {t('screens.export')}
        </Link>
      </div>
    </header>
  );
}
