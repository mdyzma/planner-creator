'use client';

import { useDroppable } from '@dnd-kit/core';
import type { PageFrame } from '@planner/core';
import { findBlock } from '@planner/core';
import type { BlockRef } from '@planner/editor';
import { setBlockSize } from '@planner/editor';
import { formatDate, localize } from '@planner/i18n';
import type { BlockRenderContext } from '@planner/renderer';
import { PX_PER_MM, PageView, SpreadView } from '@planner/renderer';
import type { BlockInstance, Locale } from '@planner/schema';
import { useLocale, useTranslations } from 'next-intl';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEditor } from '@/lib/editorStore';
import type { RenderedPage } from '@/lib/pages';
import { FILLER_PATTERN, blockRegistry, findPage, shownLabel } from '@/lib/pages';
import { turnPage } from './actions';
import type { DragData } from './EditorScreen';
import { currentPageIndex, useLayout } from './context';
import { smallButton } from './controls';

const RULER_MM = 6;

export function Canvas() {
  const t = useTranslations('Editor');
  const layout = useLayout();
  const selection = useEditor((s) => s.selection);
  const view = useEditor((s) => s.view);
  const chosenZoom = useEditor((s) => s.zoom);
  const select = useEditor((s) => s.select);
  const scroller = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setAvailable(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const index = currentPageIndex(layout, selection);
  const spread = layout.spreads.find((s) => s.left?.index === index || s.right?.index === index);
  const shown =
    view === 'spread' && spread
      ? {
          left: spread.left && layout.pages[spread.left.index],
          right: spread.right && layout.pages[spread.right.index],
        }
      : { single: layout.pages[index] };
  const any = shown.single ?? shown.left ?? shown.right;
  if (!any) return <p className="p-6 text-ink-muted">{t('noPages')}</p>;

  const pageW = any.frame.trim.w + 2 * any.frame.bleed;
  const pageH = any.frame.trim.h + 2 * any.frame.bleed;
  const widthMm = RULER_MM + (shown.single ? pageW : 2 * pageW + 1);
  const heightMm = RULER_MM + pageH + 10;
  const visible = (shown.single ? [shown.single] : [shown.left, shown.right]).filter(
    (p): p is RenderedPage => Boolean(p),
  );
  const labels = visible.map(shownLabel).join('–');
  const positions = visible.map((p) => p.page.number).join('–');
  // "Fit" scales the spread to the canvas width (48 px of padding).
  const fit = available > 0 ? (available - 48) / (widthMm * PX_PER_MM) : 0.5;
  const zoom = chosenZoom === 'fit' ? Math.min(2, Math.max(0.2, fit)) : chosenZoom;

  return (
    <div className="flex h-full flex-col">
      <PageNav labels={labels} positions={positions} first={visible[0]?.label.text ?? ''} />
      <div
        ref={scroller}
        className="flex-1 overflow-auto bg-bg p-6"
        onClick={() => select({ blockId: undefined })}
      >
        <div
          className="mx-auto"
          style={{ width: `calc(${widthMm}mm * ${zoom})`, height: `calc(${heightMm}mm * ${zoom})` }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: `${widthMm}mm`,
              display: 'flex',
            }}
          >
            <div style={{ paddingTop: `${RULER_MM}mm` }}>
              <Ruler length={any.frame.trim.h} vertical offset={any.frame.bleed} />
            </div>
            {shown.single ? (
              <EditPage page={shown.single} />
            ) : (
              <SpreadView
                left={shown.left ? <EditPage page={shown.left} /> : <Blank widthMm={pageW} />}
                right={shown.right ? <EditPage page={shown.right} /> : <Blank widthMm={pageW} />}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const Blank = ({ widthMm }: { widthMm: number }) => (
  <div aria-hidden="true" style={{ width: `${widthMm}mm` }} />
);

function PageNav({
  labels,
  positions,
  first,
}: {
  labels: string;
  positions: string;
  first: string;
}) {
  const t = useTranslations('Editor');
  const layout = useLayout();
  const select = useEditor((s) => s.select);
  const [text, setText] = useState(first);
  useEffect(() => setText(first), [first]);

  // Printed numbers first ("iv", "S1", "12"), else the position in the file.
  const go = () => {
    const index = findPage(layout.pages, text);
    if (index < 0) return;
    select({
      pageIndex: index,
      pageKey: layout.pages[index]?.page.instance?.key,
      blockId: undefined,
    });
  };

  return (
    <nav
      aria-label={t('pageNav')}
      className="flex items-center gap-3 border-b border-line bg-surface px-4 py-1.5 text-sm"
    >
      <button type="button" className={smallButton} onClick={() => turnPage(layout, -1)}>
        {t('previous')}
      </button>
      <span>
        {t('showing', { pages: labels, position: positions, total: layout.pages.length })}
      </span>
      <label className="flex items-center gap-1.5">
        {t('goTo')}
        <input
          type="text"
          inputMode="text"
          className="w-20 rounded border border-line bg-surface px-2 py-0.5"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          onBlur={go}
        />
      </label>
      <button type="button" className={smallButton} onClick={() => turnPage(layout, 1)}>
        {t('next')}
      </button>
      <span className="ml-auto text-xs text-ink-muted">{t('shortcuts')}</span>
    </nav>
  );
}

function EditPage({ page }: { page: RenderedPage }) {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const project = useEditor((s) => s.project)!;
  const guides = useEditor((s) => s.guides);
  const grid = useEditor((s) => s.grid);
  const select = useEditor((s) => s.select);
  const layout = useLayout();
  const index = page.page.index;
  const current = useEditor((s) => currentPageIndex(layout, s.selection) === index);
  const data: DragData = { kind: 'page', pageIndex: index };
  const { setNodeRef, isOver } = useDroppable({
    id: `page:${index}`,
    data,
    disabled: !page.template,
  });

  const date = page.page.instance?.context.date;
  const caption = page.template
    ? [
        localize(page.template.name, uiLocale),
        date && formatDate(date, uiLocale, 'weekday-day-month'),
      ]
        .filter(Boolean)
        .join(' · ')
    : t('filler');

  return (
    <figure
      ref={setNodeRef}
      className="m-0"
      data-current-page={current || undefined}
      onClick={(e) => {
        e.stopPropagation();
        select({ pageIndex: index, pageKey: page.page.instance?.key, blockId: undefined });
      }}
    >
      <div style={{ paddingLeft: `${page.frame.bleed}mm`, height: `${RULER_MM}mm` }}>
        <Ruler length={page.frame.trim.w} />
      </div>
      <div
        className="relative"
        style={{ outline: isOver ? '0.8mm dashed var(--ui-accent)' : undefined }}
      >
        <PageView
          frame={page.frame}
          template={page.template}
          fillerPattern={FILLER_PATTERN}
          renderBlock={(block, ctx) => (
            <EditableBlock key={block.id} block={block} ctx={ctx} page={page} />
          )}
          pageContext={page.page.instance?.context}
          vars={page.vars}
          range={layout.range}
          contentFor={page.contentFor}
          locale={project.locale}
          grammaticalGender={project.i18nOptions.grammaticalGender}
          mode="edit"
          showGuides={guides}
          printerSafeMargin={project.print.printerSafeMargin}
          pageNumber={project.print.pageNumbers && page.label.printed ? page.label.text : undefined}
          brandMark={project.print.brandMark !== false}
          label={t('pageLabel', { number: shownLabel(page), side: t(`side.${page.page.side}`) })}
        />
        {grid && <GridOverlay frame={page.frame} />}
      </div>
      <figcaption
        className={`mt-1 text-center text-[3mm] ${current ? 'font-semibold' : 'text-ink-muted'}`}
      >
        {shownLabel(page)} · {t(`side.${page.page.side}`)} · {caption}
      </figcaption>
    </figure>
  );
}

function EditableBlock({
  block,
  ctx,
  page,
}: {
  block: BlockInstance;
  ctx: BlockRenderContext;
  page: RenderedPage;
}) {
  const t = useTranslations('Editor');
  const uiLocale = useLocale() as Locale;
  const instance = page.page.instance;
  const selected = useEditor(
    (s) =>
      s.selection.blockId === block.id &&
      (s.selection.pageKey
        ? s.selection.pageKey === instance?.key
        : s.selection.pageIndex === page.page.index),
  );
  const scope = useEditor((s) => s.scope);
  const select = useEditor((s) => s.select);
  const overridden = Boolean(instance?.overrides?.[block.id]);
  const entry = page.template ? findBlock(page.template, block.id) : undefined;
  const axis =
    entry?.container === 'row' ? 'width' : entry?.container === 'free' ? undefined : 'height';
  const def = blockRegistry.get(block.type);
  const name = def ? localize(def.label, uiLocale) : block.type;

  const choose = () =>
    select({ pageIndex: page.page.index, pageKey: instance?.key, blockId: block.id });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={t('blockLabel', { name, id: block.id })}
      data-editable-block={block.id}
      data-overridden={overridden || undefined}
      onClick={(e) => {
        e.stopPropagation();
        choose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choose();
        }
      }}
      className="group relative h-full w-full cursor-pointer hover:outline-dashed hover:outline-[0.3mm] hover:outline-[var(--ui-accent)]"
      style={{
        outline: selected
          ? '0.6mm solid var(--ui-focus)'
          : overridden
            ? '0.4mm dashed #b45309'
            : undefined,
        outlineOffset: '0.4mm',
      }}
    >
      {blockRegistry.render(block, ctx)}
      {(overridden || block.locked) && (
        <span
          className="pointer-events-none absolute top-0 right-0 z-10 rounded-bl bg-surface/90 px-[1mm] text-[2.6mm] leading-tight text-ink"
          title={overridden ? t('overriddenHint') : t('lockedHint')}
        >
          {overridden && `◆ ${t('thisPage')}`}
          {overridden && block.locked && ' · '}
          {block.locked && t('locked')}
        </span>
      )}
      {selected && axis && scope === 'template' && !block.locked && instance && (
        <ResizeHandle
          axis={axis}
          blockRef={{ templateId: instance.templateId, blockId: block.id }}
        />
      )}
    </div>
  );
}

/** Drags a block's height (in a stack) or width (in a row), snapping to whole millimetres. */
function ResizeHandle({ axis, blockRef }: { axis: 'height' | 'width'; blockRef: BlockRef }) {
  const t = useTranslations('Editor');
  const drag = useRef<{ scale: number; start: number; origin: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const block = e.currentTarget.parentElement!;
    const rect = block.getBoundingClientRect();
    const px = axis === 'height' ? block.offsetHeight : block.offsetWidth;
    // Screen pixels per layout pixel: the canvas is scaled with a CSS transform.
    const scale = (axis === 'height' ? rect.height : rect.width) / px;
    drag.current = {
      scale,
      start: px / PX_PER_MM,
      origin: axis === 'height' ? e.clientY : e.clientX,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (e.g. a synthetic event); moves over the handle still resize.
    }
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { snap, apply } = useEditor.getState();
    const zoom = drag.current.scale;
    const delta =
      ((axis === 'height' ? e.clientY : e.clientX) - drag.current.origin) / zoom / PX_PER_MM;
    const mm = Math.max(3, Math.round((drag.current.start + delta) / snap) * snap);
    setLive(mm);
    apply(
      t('undo.resize'),
      (p) => setBlockSize(p, blockRef, axis, { mm }),
      `resize:${blockRef.templateId}:${blockRef.blockId}`,
    );
  };
  const onUp = () => {
    drag.current = null;
    setLive(null);
  };

  const vertical = axis === 'height';
  return (
    <div
      aria-hidden="true"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-20 flex items-center justify-center bg-[var(--ui-focus)]"
      style={
        vertical
          ? {
              left: '50%',
              bottom: '-1.4mm',
              width: '10mm',
              height: '2mm',
              marginLeft: '-5mm',
              cursor: 'ns-resize',
              borderRadius: '1mm',
            }
          : {
              top: '50%',
              right: '-1.4mm',
              width: '2mm',
              height: '10mm',
              marginTop: '-5mm',
              cursor: 'ew-resize',
              borderRadius: '1mm',
            }
      }
    >
      {live !== null && (
        <span className="absolute top-[2.5mm] rounded bg-ink px-[1mm] text-[2.8mm] whitespace-nowrap text-surface">
          {live} mm
        </span>
      )}
    </div>
  );
}

/** A 5 mm grid over the trim box, for lining things up; never printed. */
function GridOverlay({ frame }: { frame: PageFrame }) {
  const line = 'rgba(15, 111, 102, 0.22)';
  return (
    <div
      aria-hidden="true"
      data-grid-overlay
      style={{
        position: 'absolute',
        left: `${frame.bleed}mm`,
        top: `${frame.bleed}mm`,
        width: `${frame.trim.w}mm`,
        height: `${frame.trim.h}mm`,
        pointerEvents: 'none',
        backgroundImage: `linear-gradient(to right, ${line} 0.1mm, transparent 0.1mm), linear-gradient(to bottom, ${line} 0.1mm, transparent 0.1mm)`,
        backgroundSize: '5mm 5mm',
      }}
    />
  );
}

/** Millimetre ruler: ticks every mm, longer every 5, numbered every 10. */
function Ruler({
  length,
  vertical = false,
  offset = 0,
}: {
  length: number;
  vertical?: boolean;
  offset?: number;
}) {
  const ticks = Array.from({ length: Math.floor(length) + 1 }, (_, i) => i);
  const size = RULER_MM;
  const tick = (i: number) => (i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1);
  return (
    <svg
      aria-hidden="true"
      className="text-ink-muted"
      width={vertical ? `${size}mm` : `${length}mm`}
      height={vertical ? `${length}mm` : `${size}mm`}
      viewBox={vertical ? `0 0 ${size} ${length}` : `0 0 ${length} ${size}`}
      style={{ display: 'block', marginTop: vertical ? `${offset}mm` : undefined }}
    >
      {ticks.map((i) =>
        vertical ? (
          <line
            key={i}
            y1={i}
            y2={i}
            x1={size}
            x2={size - tick(i)}
            stroke="currentColor"
            strokeWidth={0.12}
          />
        ) : (
          <line
            key={i}
            x1={i}
            x2={i}
            y1={size}
            y2={size - tick(i)}
            stroke="currentColor"
            strokeWidth={0.12}
          />
        ),
      )}
      {ticks
        .filter((i) => i > 0 && i % 10 === 0)
        .map((i) =>
          vertical ? (
            <text key={`t${i}`} x={0.3} y={i - 0.4} fontSize={1.8} fill="currentColor">
              {i}
            </text>
          ) : (
            <text key={`t${i}`} x={i + 0.4} y={2.2} fontSize={1.8} fill="currentColor">
              {i}
            </text>
          ),
        )}
    </svg>
  );
}
