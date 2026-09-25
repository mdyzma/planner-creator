import type { Locale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { GuideScreen } from '@/components/GuideScreen';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  // The layout has already rejected unknown locales (dynamicParams = false).
  setRequestLocale((await params).locale as Locale);
  return <GuideScreen />;
}
