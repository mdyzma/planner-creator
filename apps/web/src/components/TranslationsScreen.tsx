'use client';

import type { TextKind, TranslationEntry } from '@planner/i18n';
import { copyTranslation, scanTranslations, setAtPath } from '@planner/i18n';
import type { Locale, LocalizedText, PlannerProject } from '@planner/schema';
import { LOCALES } from '@planner/schema';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProjectStatus } from '@/components/ProjectStatus';
import { Link } from '@/i18n/navigation';
import { useProject } from '@/lib/useProject';

const KIND_ORDER: TextKind[] = [
  'template',
  'page-template',
  'layout-label',
  'block',
  'section',
  'document-section',
  'variable',
  'content',
];

/**
 * Side-by-side English/Polish editing of every text in a planner (§7): shows what is missing,
 * copies one language into the other, and writes each edit back to exactly where it lives.
 */
export function TranslationsScreen() {
  const id = useSearchParams().get('id');
  const { state, save } = useProject(id);
  if (state.status !== 'ready') {
    return (
      <ProjectStatus
        status={state.status}
        message={state.status === 'error' ? state.message : undefined}
      />
    );
  }
  return <TranslationsEditor project={state.project} onChange={save} />;
}

function TranslationsEditor({
  project,
  onChange,
}: {
  project: PlannerProject;
  onChange: (p: PlannerProject) => Promise<void>;
}) {
  const t = useTranslations('Translations');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const report = useMemo(() => scanTranslations(project), [project]);

  const shown = report.entries.filter((e) => !onlyMissing || e.missing.length > 0);
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    entries: shown.filter((e) => e.kind === kind),
  })).filter((g) => g.entries.length > 0);

  const write = async (entry: TranslationEntry, text: LocalizedText) => {
    await onChange(setAtPath(project, entry.path, text));
    setSavedAt(Date.now());
  };

  const allDone = report.missingByLocale.en === 0 && report.missingByLocale.pl === 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href={`/preview?id=${project.id}`} className="text-sm underline">
          {t('back')}
        </Link>
        <h1 className="text-xl font-semibold">
          {t('title')} · {project.meta.name}
        </h1>
        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <p aria-live="polite">
          {t('summary', {
            total: report.total,
            missingEn: report.missingByLocale.en,
            missingPl: report.missingByLocale.pl,
          })}
          {savedAt && <span className="ml-3 text-ink-muted">· {t('saved')}</span>}
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          {t('onlyMissing')}
        </label>
      </div>

      {allDone && <p className="mb-6 text-ink-muted">{t('allDone')}</p>}
      {groups.length === 0 && !allDone && <p className="text-ink-muted">{t('noneShown')}</p>}

      {groups.map((group) => (
        <section key={group.kind} className="mb-8" aria-labelledby={`kind-${group.kind}`}>
          <h2 id={`kind-${group.kind}`} className="mb-2 text-lg font-medium">
            {t(`kind.${group.kind}`)}
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {group.entries.map((entry) => (
              <TranslationRow key={entry.path.join('/')} entry={entry} onSave={write} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TranslationRow({
  entry,
  onSave,
}: {
  entry: TranslationEntry;
  onSave: (entry: TranslationEntry, text: LocalizedText) => Promise<void>;
}) {
  const t = useTranslations('Translations');
  const common = useTranslations('Common');
  const [draft, setDraft] = useState<LocalizedText>(entry.text);

  // Follow saved changes (e.g. after a copy) without losing an edit in progress elsewhere.
  useEffect(() => setDraft(entry.text), [entry.text]);

  const commit = (text: LocalizedText) => {
    const changed = LOCALES.some((l) => (text[l] ?? '') !== (entry.text[l] ?? ''));
    if (changed) void onSave(entry, text);
  };

  const copy = (from: Locale, to: Locale) => {
    const next = copyTranslation(draft, from, to, { overwrite: true });
    setDraft(next);
    commit(next);
  };

  const language = (l: Locale) => common(`languages.${l}`);

  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(10rem,1fr)_2fr_2fr]">
      <div className="text-sm">
        <p className="font-medium break-words">{entry.ownerId}</p>
        <p className="text-ink-muted">{entry.field}</p>
        {entry.missing.map((l) => (
          <p
            key={l}
            className="mt-1 inline-block rounded border border-danger px-1.5 text-xs text-danger"
          >
            {t('missing', { language: language(l) })}
          </p>
        ))}
      </div>
      {LOCALES.map((l) => {
        const other = LOCALES.find((o) => o !== l)!;
        return (
          <div key={l} className="flex flex-col gap-1">
            <textarea
              lang={l}
              rows={2}
              aria-label={t('fieldLabel', {
                owner: entry.ownerId,
                field: entry.field,
                language: language(l),
              })}
              aria-invalid={entry.missing.includes(l) || undefined}
              className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm"
              value={draft[l] ?? ''}
              onChange={(e) => setDraft({ ...draft, [l]: e.target.value })}
              // Read the field itself: blur can fire before React re-renders the last keystroke.
              onBlur={(e) => commit({ ...draft, [l]: e.currentTarget.value })}
            />
            <button
              type="button"
              className="self-start text-xs underline disabled:no-underline disabled:opacity-50"
              disabled={!(draft[other] ?? '').trim()}
              aria-label={t('copyLabel', {
                from: language(other),
                to: language(l),
                owner: entry.ownerId,
                field: entry.field,
              })}
              onClick={() => copy(other, l)}
            >
              {other === 'en' ? t('copyEnToPl') : t('copyPlToEn')}
            </button>
          </div>
        );
      })}
    </li>
  );
}
