import type { routing } from '@/i18n/routing';
import type messages from './messages/en.json';

// Type-checks every message key and the locale union across the app.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
