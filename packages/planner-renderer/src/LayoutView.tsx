import type { GrammaticalGender } from '@planner/i18n';
import { applyGender, fillVariables, localize } from '@planner/i18n';
import type {
  BlockInstance,
  ContentItem,
  LayoutNode,
  Locale,
  LocalizedText,
  PageContext,
} from '@planner/schema';
import type { CSSProperties, ReactNode } from 'react';
import { PAPER, flexFor, mm } from './units';

/** Everything a block may need to render on a particular page. */
export interface BlockRenderContext {
  locale: Locale;
  mode: RenderMode;
  gender: GrammaticalGender;
  /** The page's place in time: its date, or the seven dates of a week page. */
  page: PageContext;
  /** Page variables for {{tokens}}; unset ones print as a writing line. */
  vars: Readonly<Record<string, string>>;
  /** First and last day of the planner, so days outside it can be greyed out. */
  range?: { start: string; end: string };
  /** Content item assigned to a block on this page (e.g. the day's quote). */
  contentFor: (blockId: string) => ContentItem | undefined;
}

export const emptyRenderContext = (
  locale: Locale,
  mode: RenderMode,
  gender: GrammaticalGender = 'slash',
): BlockRenderContext => ({
  locale,
  mode,
  gender,
  page: {},
  vars: {},
  contentFor: () => undefined,
});

/**
 * Text as it prints on this page: page locale with fallback, then {{variables}}, then gendered
 * wording (§7).
 */
export const resolveText = (ctx: BlockRenderContext, text: LocalizedText | undefined): string =>
  applyGender(fillVariables(localize(text, ctx.locale), ctx.vars), ctx.gender);

export type RenderMode = 'edit' | 'preview' | 'print';

/** Renders one block. The block registry (M3) plugs in here; core never switches on block types. */
export type BlockRenderer = (block: BlockInstance, ctx: BlockRenderContext) => ReactNode;

/** Stand-in until block types exist: shows the type and id so layouts can be checked. */
export const placeholderBlock: BlockRenderer = (block, ctx) => (
  <div
    data-block-type={block.type}
    style={{
      height: '100%',
      minHeight: mm(4),
      boxSizing: 'border-box',
      border: `${mm(0.2)} dashed ${PAPER.rule}`,
      borderRadius: mm(1),
      padding: mm(1.5),
      fontSize: '7pt',
      color: PAPER.inkMuted,
      overflow: 'hidden',
    }}
  >
    {ctx.mode === 'print' ? null : `${block.type} · ${block.id}`}
  </div>
);

interface LayoutViewProps {
  node: LayoutNode;
  ctx: BlockRenderContext;
  renderBlock: BlockRenderer;
}

/** Flow layout (ADR-0002): stacks and rows become flex boxes sized in mm / fr / auto. */
export function LayoutView({ node, ctx, renderBlock }: LayoutViewProps) {
  if (node.kind === 'block') return <>{renderBlock(node.block, ctx)}</>;

  const vertical = node.kind === 'stack';
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    gap: mm(node.gap),
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
  };
  const label = node.kind === 'stack' ? resolveText(ctx, node.label) : '';

  return (
    <div data-layout={node.kind} style={style}>
      {label && (
        <div
          style={{
            flex: '0 0 auto',
            fontSize: '7.5pt',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: PAPER.inkMuted,
          }}
        >
          {label}
        </div>
      )}
      {node.children.map((child, i) => {
        const size =
          child.kind === 'block'
            ? vertical
              ? child.block.size?.height
              : child.block.size?.width
            : vertical
              ? child.height
              : undefined;
        return (
          <div
            key={child.kind === 'block' ? child.block.id : i}
            style={{ ...flexFor(size), minWidth: 0, minHeight: 0, display: 'flex' }}
          >
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <LayoutView node={child} ctx={ctx} renderBlock={renderBlock} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
