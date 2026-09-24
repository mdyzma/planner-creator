import { LOCALES } from '@planner/schema';
import { defineRouting } from 'next-intl/routing';

/** Interface languages match planner content languages (§7); the UI locale is in the URL. */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
});

/** Remembers the chosen interface language for the root redirect. */
export const UI_LOCALE_STORAGE_KEY = 'planner.uiLocale';
