import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Caveat, Source_Sans_3 } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/ServiceWorker';
import { routing } from '@/i18n/routing';
import '../globals.css';

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Planner and interface font, self-hosted by next/font at build time (no runtime requests to
 * Google, §10.2). Latin Extended covers Polish: ą ć ę ł ń ó ś ź ż.
 */
const plannerFont = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  variable: '--planner-font',
  display: 'swap',
});

/** Handwriting for example fills in the guide and example exports (grey, never on blank pages). */
const handFont = Caveat({
  subsets: ['latin', 'latin-ext'],
  variable: '--planner-hand',
  display: 'swap',
});

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Common' });
  return {
    title: t('appName'),
    description: t('appDescription'),
    // Installable, and usable offline (scripts/build-sw.mjs).
    manifest: '/manifest.webmanifest',
    icons: { apple: '/icons/icon-192.png' },
  };
}

export const viewport: Viewport = { themeColor: '#0f6f66' };

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${plannerFont.variable} ${handFont.variable}`}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
