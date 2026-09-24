import type { Locale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { TranslationsScreen } from '@/components/TranslationsScreen';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  // The layout has already rejected unknown locales (dynamicParams = false).
  setRequestLocale((await params).locale as Locale);
  // useSearchParams (?id=…) needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<p className="p-6 text-ink-muted">…</p>}>
      <TranslationsScreen />
    </Suspense>
  );
}
