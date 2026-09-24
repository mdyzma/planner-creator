import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { ProjectDashboard } from '@/components/ProjectDashboard';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('Common');
  const d = await getTranslations('Dashboard');

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('appName')}</h1>
          <p className="mt-1 text-ink-muted">{d('intro')}</p>
        </div>
        <LanguageSwitcher />
      </header>
      <ProjectDashboard />
      <footer className="mt-16 flex flex-wrap gap-4 text-xs text-ink-muted">
        <Link href="/privacy" className="underline">
          {t('privacy')}
        </Link>
        <span>{t('build', { sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? 'local' })}</span>
      </footer>
    </main>
  );
}
