'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Shared "not found" / error / loading states for screens that load a project by ?id=. */
export function ProjectStatus({
  status,
  message,
}: {
  status: 'loading' | 'missing' | 'error';
  message?: string;
}) {
  const t = useTranslations('Common');
  if (status === 'loading') return <p className="p-6 text-ink-muted">{t('loading')}</p>;
  if (status === 'error') {
    return (
      <p role="alert" className="p-6 text-danger">
        {message}
      </p>
    );
  }
  return (
    <p className="p-6">
      {t('notFound')}{' '}
      <Link className="underline" href="/">
        {t('backToPlanners')}
      </Link>
    </p>
  );
}
