'use client';

import type { InspectorField } from '@planner/blocks';
import { findBlock, resolveTemplateForFormat } from '@planner/core';
import type { BlockRef, EditScope, ValueOrigin } from '@planner/editor';
import {
  resetBlockOnPage,
  setBlockFlag,
  setBlockSize,
  setBlockValue,
  setBlockVisibility,
  templateUsage,
  valueOrigin,
} from '@planner/editor';
import { formatDate, localize } from '@planner/i18n';
import type {
  BlockInstance,
  BlockStyle,
  Condition,
  Length,
  Locale,
  LocalizedText,
  PageInstance,
} from '@planner/schema';
import { LOCALES } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useId, useMemo } from 'react';
import { useEditor } from '@/lib/editorStore';
import { blockRegistry, shownLabel } from '@/lib/pages';
import { duplicateSelected, nudgeSelected, removeSelected } from './actions';
import { useLayout, selectedBlock, currentPageIndex } from './context';
import { Group, NumberInput, Origin, inputClass, smallButton } from './controls';
import { BUILT_IN_VARIABLES } from './LeftPanel';

type Setter = (group: 'props' | 'style', key: string, value: unknown, mergeKey?: string) => void;

export function Inspector() {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const project = useEditor((s) => s.project)!;
  const selection = useEditor((s) => s.selection);
  const scopeKind = useEditor((s) => s.scope);
  const apply = useEditor((s) => s.apply);
  const layout = useLayout();
  const usage = useMemo(() => templateUsage(project), [project]);

  const page = layout.pages[currentPageIndex(layout, selection)];
  const sel = selectedBlock(project, layout, selection);
  const instance = page?.page.instance;
  const source = sel && project.template.pageTemplates[sel.ref.templateId];
  const sourceBlock = source && findBlock(source, sel.ref.blockId)?.block;

  if (!page) return null;
  if (!sel || !source || !sourceBlock || !instance) {
    return <PageSummary />;
  }

  const ref = sel.ref;
  const formatted = findBlock(
    resolveTemplateForFormat(source, project.format).template,
    ref.blockId,
  );
  const onPage = page.template && findBlock(page.template, ref.blockId);
  const block: BlockInstance =
    scopeKind === 'page' ? (onPage?.block ?? formatted!.block) : formatted!.block;
  const container = formatted?.container ?? 'stack';
  const def = blockRegistry.get(block.type);
  const props = {
    ...(def?.defaults as Record<string, unknown> | undefined),
    ...(typeof block.props === 'object' && block.props !== null && !Array.isArray(block.props)
      ? (block.props as Record<string, unknown>)
      : {}),
  };
  const scope: EditScope =
    scopeKind === 'page' ? { kind: 'page', pageKey: instance.key } : { kind: 'template' };
  const locked = sourceBlock.locked === true;
  const hiddenOnPage = page.hidden.includes(ref.blockId);
  const pageEdits = instance.overrides?.[ref.blockId];

  const set: Setter = (group, key, value, mergeKey) =>
    apply(
      t('undo.edit', { field: key }),
      (p) => setBlockValue(p, ref, group, key, value, scope),
      mergeKey,
    );
  const origin = (group: 'props' | 'style' | 'size', key: string) =>
    valueOrigin(project, ref, group, key, scopeKind === 'page' ? instance : undefined);
  const reset = (group: 'props' | 'style', key: string) => () => set(group, key, undefined);
  const resettable = (o: ValueOrigin) =>
    scopeKind === 'page' ? o === 'page' : o !== 'default' && o !== 'page';

  const date = instance.context.date;
  const templateName = localize(page.template?.name ?? source.name, uiLocale);
  const name = def ? localize(def.label, uiLocale) : block.type;

  return (
    <div className="text-sm">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-medium">
          {name} <span className="text-xs font-normal text-ink-muted">{ref.blockId}</span>
        </h2>
        <p className="mt-1 text-xs text-ink-muted" data-scope-note>
          {scopeKind === 'page'
            ? t('appliesToPage', {
                number: shownLabel(page),
                date: date ? formatDate(date, uiLocale, 'weekday-day-month') : templateName,
              })
            : t('appliesToTemplate', { count: usage[ref.templateId] ?? 0, name: templateName })}
        </p>
        {locked && <p className="mt-1 text-xs">{t('lockedNote')}</p>}
        {hiddenOnPage && <p className="mt-1 text-xs">{t('hiddenNote')}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={smallButton}
            onClick={() => duplicateSelected(layout, t('undo.duplicate'))}
          >
            {t('duplicate')}
          </button>
          <button
            type="button"
            className={smallButton}
            disabled={locked || (formatted?.index ?? 0) === 0}
            onClick={() => nudgeSelected(layout, -1, t('undo.move'))}
          >
            {t('moveUp')}
          </button>
          <button
            type="button"
            className={smallButton}
            disabled={locked || (formatted?.index ?? 0) >= (formatted?.siblings ?? 1) - 1}
            onClick={() => nudgeSelected(layout, 1, t('undo.move'))}
          >
            {t('moveDown')}
          </button>
          <button
            type="button"
            className={smallButton}
            aria-pressed={locked}
            onClick={() =>
              apply(locked ? t('undo.unlock') : t('undo.lock'), (p) =>
                setBlockFlag(p, ref, 'locked', !locked),
              )
            }
          >
            {locked ? t('unlock') : t('lock')}
          </button>
          <button
            type="button"
            className={`${smallButton} text-danger`}
            disabled={scopeKind === 'template' && locked}
            onClick={() =>
              removeSelected(layout, { delete: t('undo.delete'), hide: t('undo.hide') })
            }
          >
            {scopeKind === 'page' ? t('hideOnPage') : t('delete')}
          </button>
          {pageEdits && (
            <button
              type="button"
              className={smallButton}
              onClick={() =>
                apply(t('undo.resetPage'), (p) => resetBlockOnPage(p, instance.key, ref.blockId))
              }
            >
              {t('resetPage')}
            </button>
          )}
        </div>
        {scopeKind === 'template' && pageEdits && (
          <p className="mt-2 text-xs">◆ {t('pageHasEdits')}</p>
        )}
      </div>

      {def && def.inspector.length > 0 && (
        <Group title={t('group.content')}>
          {def.inspector.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={props[field.key]}
              locked={locked}
              blockId={ref.blockId}
              origin={origin('props', field.key)}
              onReset={
                resettable(origin('props', field.key)) ? reset('props', field.key) : undefined
              }
              set={set}
            />
          ))}
        </Group>
      )}

      <Group title={t('group.typography')}>
        <StyleFields
          style={block.style}
          set={set}
          origin={origin}
          reset={reset}
          resettable={resettable}
          locked={locked}
        />
      </Group>

      <Group title={t('group.layout')}>
        {container !== 'free' && (
          <SizeField
            axis={container === 'row' ? 'width' : 'height'}
            value={block.size?.[container === 'row' ? 'width' : 'height']}
            disabled={locked || scopeKind === 'page'}
            origin={origin('size', container === 'row' ? 'width' : 'height')}
            onChange={(v) =>
              apply(
                t('undo.resize'),
                (p) => setBlockSize(p, ref, container === 'row' ? 'width' : 'height', v),
                `size:${ref.blockId}`,
              )
            }
          />
        )}
        {scopeKind === 'page' && <p className="text-xs text-ink-muted">{t('sizeTemplateOnly')}</p>}
        <BoxFields
          style={block.style}
          set={set}
          origin={origin}
          reset={reset}
          resettable={resettable}
          locked={locked}
        />
      </Group>

      <Group title={t('group.print')}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sourceBlock.keepTogether === true}
            disabled={locked}
            onChange={(e) =>
              apply(t('undo.edit', { field: 'keepTogether' }), (p) =>
                setBlockFlag(p, ref, 'keepTogether', e.target.checked),
              )
            }
          />
          {t('keepTogether')}
        </label>
        <VisibilityField blockRef={ref} value={sourceBlock.visibility} disabled={locked} />
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function PageSummary() {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const layout = useLayout();
  const selection = useEditor((s) => s.selection);
  const page = layout.pages[currentPageIndex(layout, selection)];
  if (!page) return null;
  const instance: PageInstance | undefined = page.page.instance;
  const date = instance?.context.date;
  return (
    <div className="flex flex-col gap-2 px-4 py-3 text-sm">
      <h2 className="font-medium">
        {t('pageLabel', { number: shownLabel(page), side: t(`side.${page.page.side}`) })}
      </h2>
      <p className="text-ink-muted">
        {page.template ? localize(page.template.name, uiLocale) : t('filler')}
        {date && ` · ${formatDate(date, uiLocale, 'weekday-day-month')}`}
      </p>
      {page.template?.rationale && (
        <p className="text-xs text-ink-muted">{localize(page.template.rationale, uiLocale)}</p>
      )}
      <p className="text-xs">{page.template ? t('selectBlock') : t('fillerNote')}</p>
      <p className="text-xs text-ink-muted">
        {t('margins', {
          inner: page.frame.margins[page.frame.bindingEdge],
          outer: page.frame.margins[page.frame.bindingEdge === 'left' ? 'right' : 'left'],
        })}
      </p>
    </div>
  );
}

function FieldRow({
  field,
  value,
  locked,
  blockId,
  origin,
  onReset,
  set,
}: {
  field: InspectorField;
  value: unknown;
  locked: boolean;
  blockId: string;
  origin: ValueOrigin;
  onReset?: () => void;
  set: Setter;
}) {
  const uiLocale = useLocale() as Locale;
  const id = useId();
  const label = localize(field.label, uiLocale);
  const head = (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <Origin origin={origin} onReset={onReset} disabled={locked} />
    </div>
  );
  const commit = (v: unknown, mergeKey?: string) => set('props', field.key, v, mergeKey);

  switch (field.kind) {
    case 'localized-text':
      return (
        <div className="flex flex-col gap-1">
          {head}
          <LocalizedTextInput
            id={id}
            value={(value as LocalizedText | undefined) ?? {}}
            multiline={field.multiline}
            disabled={locked}
            label={label}
            onChange={(v, locale) => commit(v, `${blockId}:${field.key}:${locale}`)}
          />
        </div>
      );
    case 'localized-list':
      return (
        <div className="flex flex-col gap-1">
          {head}
          <LocalizedListInput
            id={id}
            value={Array.isArray(value) ? (value as LocalizedText[]) : []}
            disabled={locked}
            label={label}
            onChange={(v, structural) =>
              commit(v, structural ? undefined : `${blockId}:${field.key}`)
            }
          />
        </div>
      );
    case 'number':
      return (
        <div className="flex flex-col gap-1">
          {head}
          <NumberInput
            id={id}
            value={typeof value === 'number' ? value : undefined}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={locked}
            onChange={(v) => v !== undefined && commit(v, `${blockId}:${field.key}`)}
          />
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-col gap-1">
          {head}
          <select
            id={id}
            className={inputClass}
            value={typeof value === 'string' ? value : ''}
            disabled={locked}
            onChange={(e) => commit(e.target.value)}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {localize(o.label, uiLocale)}
              </option>
            ))}
          </select>
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            disabled={locked}
            onChange={(e) => commit(e.target.checked)}
          />
          <label htmlFor={id} className="font-medium">
            {label}
          </label>
          <Origin origin={origin} onReset={onReset} disabled={locked} />
        </div>
      );
  }
}

/** English and Polish side by side, with copy-across, missing markers and a variable picker. */
function LocalizedTextInput({
  id,
  value,
  multiline,
  disabled,
  label,
  onChange,
}: {
  id: string;
  value: LocalizedText;
  multiline?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: LocalizedText, locale: Locale | 'both') => void;
}) {
  const t = useTranslations('Editor');
  const project = useEditor((s) => s.project)!;
  const variables = [...project.template.variables.map((v) => v.name), ...BUILT_IN_VARIABLES];
  const [from, to] = LOCALES;

  return (
    <div className="flex flex-col gap-1.5">
      {LOCALES.map((locale, i) => {
        const text = value[locale] ?? '';
        const props = {
          id: i === 0 ? id : `${id}-${locale}`,
          'aria-label': t('localizedField', { field: label, language: locale.toUpperCase() }),
          className: `${inputClass} ${text.trim() ? '' : 'border-dashed border-danger'}`,
          value: text,
          disabled,
          lang: locale,
          onChange: (e: { target: { value: string } }) =>
            onChange({ ...value, [locale]: e.target.value }, locale),
        };
        return (
          <div key={locale} className="flex gap-1.5">
            <span className="w-6 pt-1 text-xs font-semibold text-ink-muted">
              {locale.toUpperCase()}
            </span>
            <div className="flex-1">
              {multiline ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
              {!text.trim() && <span className="text-xs text-danger">{t('missing')}</span>}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-1.5 pl-7">
        <button
          type="button"
          className={smallButton}
          disabled={disabled || !value[from!]?.trim()}
          onClick={() => onChange({ ...value, [to!]: value[from!] ?? '' }, 'both')}
        >
          {t('copyAcross', { from: from!.toUpperCase(), to: to!.toUpperCase() })}
        </button>
        <button
          type="button"
          className={smallButton}
          disabled={disabled || !value[to!]?.trim()}
          onClick={() => onChange({ ...value, [from!]: value[to!] ?? '' }, 'both')}
        >
          {t('copyAcross', { from: to!.toUpperCase(), to: from!.toUpperCase() })}
        </button>
        <select
          aria-label={t('insertVariable')}
          className="rounded border border-line bg-surface px-1 py-0.5 text-xs"
          value=""
          disabled={disabled}
          onChange={(e) => {
            const token = `{{${e.target.value}}}`;
            const next: LocalizedText = {};
            for (const l of LOCALES) next[l] = `${value[l] ?? ''}${token}`;
            onChange(next, 'both');
          }}
        >
          <option value="">{t('insertVariable')}</option>
          {variables.map((v) => (
            <option key={v} value={v}>
              {`{{${v}}}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LocalizedListInput({
  id,
  value,
  disabled,
  label,
  onChange,
}: {
  id: string;
  value: LocalizedText[];
  disabled?: boolean;
  label: string;
  onChange: (value: LocalizedText[], structural: boolean) => void;
}) {
  const t = useTranslations('Editor');
  const update = (i: number, item: LocalizedText) =>
    onChange(
      value.map((v, j) => (j === i ? item : v)),
      false,
    );
  const move = (i: number, d: -1 | 1) => {
    const copy = [...value];
    const [item] = copy.splice(i, 1);
    copy.splice(i + d, 0, item!);
    onChange(copy, true);
  };
  return (
    <ol id={id} className="flex flex-col gap-2">
      {value.map((item, i) => (
        <li key={i} className="flex flex-col gap-1 rounded border border-line p-1.5">
          {LOCALES.map((locale) => (
            <input
              key={locale}
              type="text"
              lang={locale}
              aria-label={t('listItem', {
                field: label,
                number: i + 1,
                language: locale.toUpperCase(),
              })}
              placeholder={locale.toUpperCase()}
              className={`${inputClass} ${item[locale]?.trim() ? '' : 'border-dashed border-danger'}`}
              value={item[locale] ?? ''}
              disabled={disabled}
              onChange={(e) => update(i, { ...item, [locale]: e.target.value })}
            />
          ))}
          <div className="flex gap-1">
            <button
              type="button"
              className={smallButton}
              disabled={disabled || i === 0}
              onClick={() => move(i, -1)}
            >
              {t('moveUp')}
            </button>
            <button
              type="button"
              className={smallButton}
              disabled={disabled || i === value.length - 1}
              onClick={() => move(i, 1)}
            >
              {t('moveDown')}
            </button>
            <button
              type="button"
              className={`${smallButton} ml-auto text-danger`}
              disabled={disabled}
              onClick={() =>
                onChange(
                  value.filter((_, j) => j !== i),
                  true,
                )
              }
            >
              {t('remove')}
            </button>
          </div>
        </li>
      ))}
      <li>
        <button
          type="button"
          className={smallButton}
          disabled={disabled}
          onClick={() => onChange([...value, { en: '', pl: '' }], true)}
        >
          {t('addItem')}
        </button>
      </li>
    </ol>
  );
}

// ---------------------------------------------------------------------------------------------

interface StyleProps {
  style: BlockStyle | undefined;
  set: Setter;
  origin: (group: 'style', key: string) => ValueOrigin;
  reset: (group: 'style', key: string) => () => void;
  resettable: (o: ValueOrigin) => boolean;
  locked: boolean;
}

function StyleRow({
  label,
  styleKey,
  children,
  ...p
}: StyleProps & {
  label: string;
  styleKey: keyof BlockStyle;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  const o = p.origin('style', styleKey);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id}>{label}</label>
        <Origin
          origin={o}
          onReset={p.resettable(o) ? p.reset('style', styleKey) : undefined}
          disabled={p.locked}
        />
      </div>
      {children(id)}
    </div>
  );
}

function StyleFields(p: StyleProps) {
  const t = useTranslations('Editor.style');
  const s = p.style ?? {};
  const num = (key: keyof BlockStyle, min: number, max: number, step: number) => (id: string) => (
    <NumberInput
      id={id}
      value={s[key] as number | undefined}
      min={min}
      max={max}
      step={step}
      disabled={p.locked}
      onChange={(v) => p.set('style', key, v, `style:${key}`)}
    />
  );
  const choice = (key: keyof BlockStyle, options: [string, string][]) => (id: string) => (
    <select
      id={id}
      className={inputClass}
      value={(s[key] as string | number | undefined) ?? ''}
      disabled={p.locked}
      onChange={(e) => {
        const raw = e.target.value;
        p.set('style', key, raw === '' ? undefined : key === 'fontWeight' ? Number(raw) : raw);
      }}
    >
      <option value="">{t('blockDefault')}</option>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <StyleRow {...p} label={t('font')} styleKey="fontToken">
        {choice('fontToken', [
          ['sans', t('sans')],
          ['serif', t('serif')],
        ])}
      </StyleRow>
      <StyleRow {...p} label={t('size')} styleKey="fontSizePt">
        {num('fontSizePt', 4, 96, 0.5)}
      </StyleRow>
      <StyleRow {...p} label={t('weight')} styleKey="fontWeight">
        {choice('fontWeight', [
          ['400', t('regular')],
          ['500', t('medium')],
          ['600', t('semibold')],
          ['700', t('bold')],
        ])}
      </StyleRow>
      <StyleRow {...p} label={t('lineHeight')} styleKey="lineHeight">
        {num('lineHeight', 0.8, 3, 0.05)}
      </StyleRow>
      <StyleRow {...p} label={t('letterSpacing')} styleKey="letterSpacingEm">
        {num('letterSpacingEm', -0.2, 1, 0.01)}
      </StyleRow>
      <StyleRow {...p} label={t('align')} styleKey="align">
        {choice('align', [
          ['start', t('start')],
          ['center', t('center')],
          ['end', t('end')],
          ['justify', t('justify')],
        ])}
      </StyleRow>
      <StyleRow {...p} label={t('color')} styleKey="colorToken">
        {choice('colorToken', [
          ['ink', t('ink')],
          ['muted', t('muted')],
        ])}
      </StyleRow>
    </>
  );
}

function BoxFields(p: StyleProps) {
  const t = useTranslations('Editor.style');
  const s = p.style ?? {};
  const num = (key: keyof BlockStyle, min: number, max: number, step: number) => (id: string) => (
    <NumberInput
      id={id}
      value={s[key] as number | undefined}
      min={min}
      max={max}
      step={step}
      disabled={p.locked}
      onChange={(v) => p.set('style', key, v, `style:${key}`)}
    />
  );
  return (
    <>
      <StyleRow {...p} label={t('padding')} styleKey="padding">
        {num('padding', 0, 50, 0.5)}
      </StyleRow>
      <StyleRow {...p} label={t('border')} styleKey="borderWidthPt">
        {num('borderWidthPt', 0, 10, 0.25)}
      </StyleRow>
      <StyleRow {...p} label={t('radius')} styleKey="radius">
        {num('radius', 0, 20, 0.5)}
      </StyleRow>
    </>
  );
}

type SizeMode = 'share' | 'auto' | 'mm' | 'fr';

function SizeField({
  axis,
  value,
  disabled,
  origin,
  onChange,
}: {
  axis: 'height' | 'width';
  value: Length | undefined;
  disabled: boolean;
  origin: ValueOrigin;
  onChange: (v: Length | undefined) => void;
}) {
  const t = useTranslations('Editor.size');
  const id = useId();
  const mode: SizeMode =
    value === undefined ? 'share' : value === 'auto' ? 'auto' : 'mm' in value ? 'mm' : 'fr';
  const amount = value && value !== 'auto' ? ('mm' in value ? value.mm : value.fr) : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id}>{t(axis)}</label>
        <Origin origin={origin} />
      </div>
      <div className="flex gap-1.5">
        <select
          id={id}
          className={inputClass}
          value={mode}
          disabled={disabled}
          onChange={(e) => {
            const m = e.target.value as SizeMode;
            onChange(
              m === 'share'
                ? undefined
                : m === 'auto'
                  ? 'auto'
                  : m === 'mm'
                    ? { mm: amount ?? 20 }
                    : { fr: 1 },
            );
          }}
        >
          <option value="share">{t('share')}</option>
          <option value="auto">{t('auto')}</option>
          <option value="mm">{t('mm')}</option>
          <option value="fr">{t('fr')}</option>
        </select>
        {(mode === 'mm' || mode === 'fr') && (
          <NumberInput
            label={t(mode)}
            value={amount}
            min={mode === 'mm' ? 3 : 0.1}
            max={mode === 'mm' ? 300 : 20}
            step={mode === 'mm' ? 1 : 0.5}
            disabled={disabled}
            onChange={(v) => v !== undefined && onChange(mode === 'mm' ? { mm: v } : { fr: v })}
          />
        )}
      </div>
    </div>
  );
}

const SIDE_RULES: Record<'left' | 'right', Condition> = {
  left: { '==': [{ var: 'page.side' }, 'left'] },
  right: { '==': [{ var: 'page.side' }, 'right'] },
};

function VisibilityField({
  blockRef,
  value,
  disabled,
}: {
  blockRef: BlockRef;
  value: Condition | undefined;
  disabled: boolean;
}) {
  const t = useTranslations('Editor.visibility');
  const apply = useEditor((s) => s.apply);
  const id = useId();
  const current = !value
    ? 'always'
    : JSON.stringify(value) === JSON.stringify(SIDE_RULES.left)
      ? 'left'
      : JSON.stringify(value) === JSON.stringify(SIDE_RULES.right)
        ? 'right'
        : 'custom';
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>{t('label')}</label>
      <select
        id={id}
        className={inputClass}
        value={current}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value as 'always' | 'left' | 'right';
          apply(t('changed'), (p) =>
            setBlockVisibility(p, blockRef, v === 'always' ? undefined : SIDE_RULES[v]),
          );
        }}
      >
        <option value="always">{t('always')}</option>
        <option value="left">{t('left')}</option>
        <option value="right">{t('right')}</option>
        {current === 'custom' && (
          <option value="custom" disabled>
            {t('custom')}
          </option>
        )}
      </select>
    </div>
  );
}
