import type { BlockPatch, FormatId, PageTemplate, Side } from '@planner/schema';
import { mapBlocks } from './blocks';
import { evaluateCondition } from './condition';
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
 * (merged by the block registry) → template block → format adjustment → side variant → the
 * page's own override.
 */
export function resolvePageTemplate(
  source: PageTemplate,
  { format, side, overrides, scope }: ResolvePageOptions,
): ResolvedPage {
  const { template: formatted, warnings } = resolveTemplateForFormat(source, format);
  const hidden: string[] = [];

  const template = mapBlocks(formatted, (block) => {
    const patch = overrides?.[block.id];
    if (patch?.hidden || (block.visibility && !evaluateCondition(block.visibility, scope ?? {}))) {
      hidden.push(block.id);
      return null;
    }
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

  return { template, hidden, warnings };
}
