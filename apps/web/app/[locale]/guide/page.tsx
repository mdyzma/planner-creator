import type { Locale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { GuideScreen } from '@/components/GuideScreen';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  // The layout has already rejected unknown locales (dynamicParams = false).
  setRequestLocale((await params).locale as Locale);
  // useSearchParams (?edition=…) needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={<p className="p-6 text-ink-muted">…</p>}>
      <GuideScreen />
    </Suspense>
  );
}
