'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { UI_LOCALE_STORAGE_KEY, routing } from '@/i18n/routing';

/**
 * Switches the interface language at any time, keeping the current page and query (?id=…).
 * Independent of the planner's own content language (§7).
 */
export function LanguageSwitcher() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const id = useId();

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id}>{t('interfaceLanguage')}</label>
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
