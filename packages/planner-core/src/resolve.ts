import type { BlockInstance, BlockPatch, FormatId, PageTemplate, Side } from '@planner/schema';
import { mapBlocks } from './blocks';
import { evaluateCondition } from './condition';
import { activeVariant } from './modules';
import type { PatchWarning } from './patch';
import { resolveTemplateForFormat } from './patch';

export interface ResolvePageOptions {
  format: FormatId;
  side: Side;
  /** The page instance's own changes, keyed by block id. */
  overrides?: Readonly<Record<string, BlockPatch>>;
  /** Data for blocks' visibility rules, e.g. `{ page, config, vars }`. */
  scope?: Readonly<Record<string, unknown>>;
}

export interface ResolvedPage {
  /** The template as it prints on this page. */
  template: PageTemplate;
  /** Blocks left out on this page: hidden on the page or by their visibility rule. */
  hidden: string[];
  warnings: PatchWarning[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The page template as it prints on one page (§4.4). Precedence, low → high: block defaults
 * (merged by the block registry) → template block → format adjustment → the block's first
 * matching variant (e.g. wording for a module that is off; ADR-0010) → side variant → the
 * page's own override. Examples follow the same idea: the first matching example variant
 * replaces the examples of the blocks it lists.
 */
export function resolvePageTemplate(
  source: PageTemplate,
  { format, side, overrides, scope }: ResolvePageOptions,
): ResolvedPage {
  const { template: formatted, warnings } = resolveTemplateForFormat(source, format);
  const hidden: string[] = [];

  const template = mapBlocks(formatted, (source) => {
    const patch = overrides?.[source.id];
    if (
      patch?.hidden ||
      (source.visibility && !evaluateCondition(source.visibility, scope ?? {}))
    ) {
      hidden.push(source.id);
      return null;
    }
    const block = withVariant(source, scope ?? {});
    const sideStyle = block.sideVariants?.[side];
    if (!sideStyle && !patch) return block;

    const { sideVariants: _applied, ...rest } = block;
    const style = { ...block.style, ...sideStyle, ...patch?.style };
    const props =
      patch?.props !== undefined && isRecord(patch.props) && isRecord(block.props)
        ? { ...block.props, ...patch.props }
        : (patch?.props ?? block.props);
    return {
      ...rest,
      props: props as typeof block.props,
      ...(Object.keys(style).length > 0 ? { style } : {}),
    };
  });

  return { template: withSampleVariant(template, scope ?? {}), hidden, warnings };
}

/** The page's examples with its first matching example variant applied, block by block. */
function withSampleVariant(
  page: PageTemplate,
  scope: Readonly<Record<string, unknown>>,
): PageTemplate {
  if (!page.sampleVariants) return page;
  const { sampleVariants, ...rest } = page;
  const found = sampleVariants.find((v) => evaluateCondition(v.when, scope));
  return found ? { ...rest, sampleContent: { ...page.sampleContent, ...found.content } } : rest;
}

/** The block with its first matching variant applied (props merged, style merged). */
function withVariant<B extends BlockInstance>(
  block: B,
  scope: Readonly<Record<string, unknown>>,
): B {
  const found = activeVariant(block, scope);
  if (!found) return block;
  const { variant } = found;
  const props =
    variant.props !== undefined && isRecord(variant.props) && isRecord(block.props)
      ? { ...block.props, ...variant.props }
      : (variant.props ?? block.props);
  return {
    ...block,
    props: props as B['props'],
    ...(variant.style ? { style: { ...block.style, ...variant.style } } : {}),
  };
}
