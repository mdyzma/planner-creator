'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { UI_LOCALE_STORAGE_KEY, routing } from '@/i18n/routing';
import { Icon } from './Icon';

/**
 * Switches the interface language at any time, keeping the current page and query (?id=…).
 * Independent of the planner's own content language (§7). `compact`: a globe instead of the
 * written label, for the app bar.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('Common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const id = useId();

  return (
    <div className="flex items-center gap-2 text-sm">
      <label
        htmlFor={id}
        title={t('interfaceLanguage')}
        className={compact ? 'text-ink-muted' : undefined}
      >
        {compact ? (
          <>
            <Icon name="globe" />
            <span className="sr-only">{t('interfaceLanguage')}</span>
          </>
        ) : (
          t('interfaceLanguage')
        )}
      </label>
      <select
        id={id}
        className="rounded border border-line bg-surface px-2 py-1"
        value={locale}
        onChange={(e) => {
          const next = e.target.value as (typeof routing.locales)[number];
          try {
            localStorage.setItem(UI_LOCALE_STORAGE_KEY, next);
          } catch {
            // Storage may be blocked; the switch still works for this visit.
          }
          router.replace(`${pathname}${window.location.search}`, { locale: next });
        }}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {t(`languages.${l}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
