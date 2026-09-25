import type { Box, PageFrame } from '@planner/core';
import type { GrammaticalGender } from '@planner/i18n';
import type { ContentItem, Locale, PageContext, PageTemplate, PatternSpec } from '@planner/schema';
import type { CSSProperties } from 'react';
import { Guides } from './Guides';
import type { BlockRenderContext, BlockRenderer, BlockSample, RenderMode } from './LayoutView';
import { LayoutView, placeholderBlock } from './LayoutView';
import { Pattern } from './Pattern';
import { PAPER, flexFor, mm } from './units';

export interface PageViewProps {
  frame: PageFrame;
  /** Absent for filler pages. */
  template?: PageTemplate;
  /** Pattern for filler pages (the notes page), e.g. 5 mm dots. */
  fillerPattern?: PatternSpec;
  locale: Locale;
  /** How gendered wording like {g:wdzięczny|wdzięczna} prints (project setting). */
  grammaticalGender?: GrammaticalGender;
  mode: RenderMode;
  showGuides?: boolean;
  printerSafeMargin?: number;
  pageNumber?: number;
  renderBlock?: BlockRenderer;
  /** The page's date context (from its page instance). */
  pageContext?: PageContext;
  /** Resolved page variables for {{tokens}}. */
  vars?: Readonly<Record<string, string>>;
  /** First and last planner day. */
  range?: { start: string; end: string };
  /** Content assigned to blocks on this page, keyed by block id. */
  contentFor?: (blockId: string) => ContentItem | undefined;
  /** Accessible name for the page region on screen. */
  label?: string;
  /** Example mode: draw the template's sample handwriting (never in a normal export). */
  samples?: boolean;
}

const at = (b: Box): CSSProperties => ({
  position: 'absolute',
  left: mm(b.x),
  top: mm(b.y),
  width: mm(b.w),
  height: mm(b.h),
});

/**
 * One printable page at real size. The outer box is trim + bleed; content is positioned in mm
 * from the trim box, so screen, print preview and PDF share the same geometry (§8.1).
 */
export function PageView({
  frame,
  template,
  fillerPattern,
  locale,
  grammaticalGender = 'slash',
  mode,
  showGuides = mode === 'edit',
  printerSafeMargin = 5,
  pageNumber,
  renderBlock = placeholderBlock,
  pageContext = {},
  vars = {},
  range,
  contentFor = () => undefined,
  label,
  samples = false,
}: PageViewProps) {
  const ctx: BlockRenderContext = {
    locale,
    mode,
    gender: grammaticalGender,
    page: pageContext,
    vars,
    range,
    contentFor,
    ...(samples && template?.sampleContent
      ? { sample: (id: string) => template.sampleContent?.[id] as BlockSample | undefined }
      : {}),
  };
  const { trim, bleed, body } = frame;
  const background = template ? template.background : fillerPattern;

  return (
    <div
      data-page-side={frame.side}
      data-format={frame.format}
      role={mode === 'print' ? undefined : 'region'}
      aria-label={mode === 'print' ? undefined : label}
      className={mode === 'print' ? 'planner-print-page' : undefined}
      style={{
        position: 'relative',
        width: mm(trim.w + 2 * bleed),
        height: mm(trim.h + 2 * bleed),
        background: PAPER.paper,
        color: PAPER.ink,
        fontFamily: PAPER.font,
        fontSize: '9pt',
        lineHeight: 1.3,
        overflow: 'hidden',
        flex: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: mm(bleed),
          top: mm(bleed),
          width: mm(trim.w),
          height: mm(trim.h),
        }}
      >
        {background && (
          <div style={at(body)}>
            <Pattern spec={background} width={body.w} height={body.h} />
          </div>
        )}
        {template && (
          <div data-region="body" style={at(body)}>
            <LayoutView node={template.body} ctx={ctx} renderBlock={renderBlock} />
          </div>
        )}
        {template?.outerRail && frame.outerRail && (
          <div
            data-region="outer-rail"
            style={{ ...at(frame.outerRail), display: 'flex', flexDirection: 'column', gap: mm(4) }}
          >
            {template.outerRail.map((block) => (
              <div
                key={block.id}
                style={{ ...flexFor(block.size?.height ?? 'auto'), minHeight: 0, display: 'flex' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>{renderBlock(block, ctx)}</div>
              </div>
            ))}
          </div>
        )}
        {pageNumber !== undefined && (
          <div
            data-page-number
            style={{
              position: 'absolute',
              bottom: mm(Math.max(4, frame.margins.bottom / 2 - 2)),
              // Page numbers sit at the outer corner, away from the binding.
              ...(frame.bindingEdge === 'left'
                ? { right: mm(frame.margins.right) }
                : { left: mm(frame.margins.left) }),
              fontSize: '8pt',
              color: PAPER.inkMuted,
            }}
          >
            {pageNumber}
          </div>
        )}
        {mode !== 'print' && showGuides && (
          <Guides frame={frame} printerSafeMargin={printerSafeMargin} />
        )}
      </div>
    </div>
  );
}
