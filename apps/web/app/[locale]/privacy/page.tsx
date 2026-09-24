import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link } from '@/i18n/navigation';

/** Sections of the privacy notice, in order (§10.2). */
const SECTIONS = [
  'stored',
  'tracking',
  'export',
  'hosting',
  'paper',
  'backups',
  'contact',
] as const;

const REPOSITORY_URL = 'https://github.com/mdyzma/planner-creator';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('Privacy');
  const common = await getTranslations('Common');

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm underline">
            {common('planners')}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('updated')}</p>
        </div>
        <LanguageSwitcher />
      </header>
      <p className="mb-6">{t('summary')}</p>
      {SECTIONS.map((section) => (
        <section key={section} className="mb-6">
          <h2 className="mb-2 text-lg font-medium">{t(`${section}.title`)}</h2>
          <p className="leading-relaxed">
            {t.rich(`${section}.body`, {
              repo: (chunks) => (
                <a href={REPOSITORY_URL} className="underline" rel="noreferrer">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      ))}
    </main>
  );
}
