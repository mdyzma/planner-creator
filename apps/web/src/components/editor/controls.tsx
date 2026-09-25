'use client';

import type { ValueOrigin } from '@planner/editor';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export const inputClass =
  'w-full rounded border border-line bg-surface px-2 py-1 text-sm disabled:opacity-50';
export const smallButton =
  'rounded border border-line bg-surface px-2 py-0.5 text-xs hover:bg-bg disabled:opacity-40 disabled:hover:bg-surface';

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, ReactNode]>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex items-center gap-2 text-sm">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true">{label}</span>
      <div className="flex overflow-hidden rounded border border-line">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onChange(v)}
            className={`px-2.5 py-1 ${v === value ? 'bg-accent text-accent-ink' : 'bg-surface hover:bg-bg'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Where a value comes from, with a reset button when it is set above the default. Shown as text
 * and a marker shape, not colour alone.
 */
export function Origin({
  origin,
  onReset,
  disabled,
}: {
  origin: ValueOrigin;
  onReset?: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations('Editor.origin');
  if (origin === 'default') return null;
  const marker = { page: '◆', variant: '■', format: '▲', template: '●' }[origin];
  return (
    <span className="ml-auto flex items-center gap-1 text-xs text-ink-muted">
      <span aria-hidden="true">{marker}</span>
      {t(origin)}
      {onReset && (
        <button
          type="button"
          className={smallButton}
          onClick={onReset}
          disabled={disabled}
          title={t('resetHint')}
        >
          {t('reset')}
        </button>
      )}
    </span>
  );
}

/** A number input that commits valid numbers only, and follows outside changes (undo). */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  id,
  label,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  id?: string;
  label?: string;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  return (
    <input
      id={id}
      aria-label={label}
      type="number"
      className={inputClass}
      value={text}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value === '') return onChange(undefined);
        const n = Number(e.target.value);
        if (
          Number.isFinite(n) &&
          (min === undefined || n >= min) &&
          (max === undefined || n <= max)
        )
          onChange(n);
      }}
    />
  );
}

/** Collapsible inspector group. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="border-b border-line px-4 py-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}
