'use client';

import { useEffect } from 'react';
import { UI_LOCALE_STORAGE_KEY, routing } from '@/i18n/routing';

type UiLocale = (typeof routing.locales)[number];

function preferredLocale(): UiLocale {
  const isSupported = (l: string | null | undefined): l is UiLocale =>
    !!l && (routing.locales as readonly string[]).includes(l);
  try {
    const saved = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    if (isSupported(saved)) return saved;
  } catch {
    // Storage can be blocked (private mode); fall through to the browser language.
  }
  const fromBrowser = navigator.languages.map((l) => l.slice(0, 2).toLowerCase()).find(isSupported);
  return fromBrowser ?? routing.defaultLocale;
}

export function LocaleRedirect() {
  useEffect(() => {
    window.location.replace(`/${preferredLocale()}`);
  }, []);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="flex gap-4">
        <a className="underline" href="/en">
          English
        </a>
        <a className="underline" href="/pl" lang="pl">
          Polski
        </a>
      </p>
    </main>
  );
}
