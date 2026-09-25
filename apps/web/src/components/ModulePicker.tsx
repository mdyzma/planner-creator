'use client';

import { effectiveModules, matchingPreset } from '@planner/core';
import { localize } from '@planner/i18n';
import type { Locale, PlannerTemplate } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';

const CUSTOM = '';

/**
 * The planner's edition and modules (ADR-0010): a preset to pick in one step, and the modules
 * behind it to switch one by one. Shows nothing for templates without modules.
 */
export function ModulePicker({
  template,
  modules,
  onChange,
  fieldClass,
  labelClass = 'flex flex-col gap-1 text-sm',
}: {
  template: Pick<PlannerTemplate, 'modules' | 'presets'>;
  /** The planner's own choices; modules not listed take the template's defaults. */
  modules: Readonly<Record<string, boolean>> | undefined;
  onChange: (modules: Record<string, boolean>) => void;
  fieldClass: string;
  /** Label layout: stacked (forms) or inline (toolbars). */
  labelClass?: string;
}) {
  const t = useTranslations('Dashboard');
  const locale = useLocale() as Locale;
  const ids = useId();
  if (!template.modules?.length) return null;

  const current = effectiveModules(template, { modules: modules ? { ...modules } : undefined });
  const preset = matchingPreset(template, current) ?? CUSTOM;
  const on = template.modules.filter((m) => current[m.id]).length;

  return (
    <>
      <label className={labelClass}>
        {t('edition')}
        <select
          className={fieldClass}
          value={preset}
          onChange={(e) => {
            const chosen = template.presets?.find((p) => p.id === e.target.value);
            if (chosen) onChange({ ...chosen.modules });
          }}
        >
          {template.presets?.map((p) => (
            <option key={p.id} value={p.id} title={localize(p.description, locale)}>
              {localize(p.name, locale)}
            </option>
          ))}
          {preset === CUSTOM && <option value={CUSTOM}>{t('customEdition')}</option>}
        </select>
      </label>
      <details className="relative text-sm">
        <summary className={`${fieldClass} cursor-pointer select-none list-none`}>
          {t('modules', { on, total: template.modules.length })}
        </summary>
        <fieldset
          aria-labelledby={`${ids}-legend`}
          className="absolute z-20 mt-1 w-80 space-y-2 rounded border border-line bg-surface p-3 shadow-lg"
        >
          <legend id={`${ids}-legend`} className="sr-only">
            {t('modulesLegend')}
          </legend>
          {template.modules.map((m) => (
            <label key={m.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={current[m.id] ?? false}
                onChange={(e) => onChange({ ...current, [m.id]: e.target.checked })}
              />
              <span>
                <span className="font-medium">{localize(m.name, locale)}</span>
                <span className="block text-xs text-ink-muted">
                  {localize(m.description, locale)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </details>
    </>
  );
}
