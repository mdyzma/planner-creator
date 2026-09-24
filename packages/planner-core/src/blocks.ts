import type { BlockInstance, JsonPatchOp, LayoutNode, PageTemplate } from '@planner/schema';

/**
 * Block tree helpers for page templates. Blocks live in three regions: the flow body (a tree of
 * stacks and rows), the outer-margin rail and the free layer. Editing works on block ids; JSON
 * pointers only exist for per-format adjustments, which these helpers keep pointing at the same
 * blocks when blocks move (§5.3, M6).
 */

export type BlockRegion = 'body' | 'outerRail' | 'free';

export interface BlockEntry {
  block: BlockInstance;
  region: BlockRegion;
  /** JSON pointer to the block instance, e.g. `/body/children/2/block` or `/outerRail/0`. */
  pointer: string;
  /** Container the block sits in (a stack or row in the body; the region list otherwise). */
  container: 'stack' | 'row' | 'rail' | 'free';
  /** Position among its container's children. */
  index: number;
  /** Number of children in the container. */
  siblings: number;
}

function walk(
  node: LayoutNode,
  pointer: string,
  out: BlockEntry[],
  parent?: { kind: 'stack' | 'row'; index: number; siblings: number },
) {
  if (node.kind === 'block') {
    out.push({
      block: node.block,
      region: 'body',
      pointer: `${pointer}/block`,
      container: parent?.kind ?? 'stack',
      index: parent?.index ?? 0,
      siblings: parent?.siblings ?? 1,
    });
    return;
  }
  node.children.forEach((child, i) =>
    walk(child, `${pointer}/children/${i}`, out, {
      kind: node.kind,
      index: i,
      siblings: node.children.length,
    }),
  );
}

/** Every block in the template, in reading order: body, outer rail, free layer. */
export function listBlocks(template: PageTemplate): BlockEntry[] {
  const out: BlockEntry[] = [];
  walk(template.body, '/body', out);
  const list = (region: 'outerRail' | 'free', blocks: BlockInstance[] | undefined) =>
    blocks?.forEach((block, index) =>
      out.push({
        block,
        region,
        pointer: `/${region}/${index}`,
        container: region === 'outerRail' ? 'rail' : 'free',
        index,
        siblings: blocks.length,
      }),
    );
  list('outerRail', template.outerRail);
  list('free', template.free);
  return out;
}

export const findBlock = (template: PageTemplate, id: string): BlockEntry | undefined =>
  listBlocks(template).find((e) => e.block.id === id);

/**
 * Rewrites every block; returning `null` removes it. Stacks and rows are kept even when they
 * become empty, so the layout's proportions stay put.
 */
export function mapBlocks(
  template: PageTemplate,
  fn: (block: BlockInstance, region: BlockRegion) => BlockInstance | null,
): PageTemplate {
  const mapNode = (node: LayoutNode): LayoutNode | null => {
    if (node.kind === 'block') {
      const block = fn(node.block, 'body');
      return block ? (block === node.block ? node : { ...node, block }) : null;
    }
    return {
      ...node,
      children: node.children.map(mapNode).filter((c): c is LayoutNode => c !== null),
    };
  };
  const mapList = (region: 'outerRail' | 'free', blocks: BlockInstance[] | undefined) =>
    blocks?.map((b) => fn(b, region)).filter((b): b is BlockInstance => b !== null);

  const body = mapNode(template.body) ?? { kind: 'stack', gap: 4, children: [] };
  const outerRail = mapList('outerRail', template.outerRail);
  const free = mapList('free', template.free);
  return {
    ...template,
    body,
    ...(outerRail ? { outerRail } : {}),
    ...(free ? { free } : {}),
  };
}

/** A block id not used in this template yet: `quote`, then `quote-2`, `quote-3`… */
export function uniqueBlockId(template: PageTemplate, base: string): string {
  const taken = new Set(listBlocks(template).map((e) => e.block.id));
  const stem = base.replace(/-\d+$/, '') || 'block';
  if (!taken.has(stem)) return stem;
  for (let n = 2; ; n++) if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

/**
 * Keeps per-format adjustments attached to the same blocks after the template's structure
 * changed: each operation below a block's pointer is re-pointed to where that block is now, and
 * operations for blocks that no longer exist are dropped. Operations that do not target a block
 * (e.g. a stack's height) are kept as they are.
 */
export function retargetFormatOverrides(before: PageTemplate, after: PageTemplate): PageTemplate {
  if (!after.formatOverrides) return after;
  const oldPointers = listBlocks(before).map((e) => [e.pointer, e.block.id] as const);
  // Longest first, so a nested pointer never matches a shorter prefix.
  oldPointers.sort((a, b) => b[0].length - a[0].length);
  const newPointer = new Map(listBlocks(after).map((e) => [e.block.id, e.pointer]));

  const retarget = (op: JsonPatchOp): JsonPatchOp | null => {
    const match = oldPointers.find(([p]) => op.path === p || op.path.startsWith(`${p}/`));
    if (!match) return op;
    const [pointer, id] = match;
    const target = newPointer.get(id);
    if (!target) return null;
    return target === pointer ? op : { ...op, path: target + op.path.slice(pointer.length) };
  };

  const formatOverrides = Object.fromEntries(
    Object.entries(after.formatOverrides).map(([format, ops]) => [
      format,
      (ops ?? []).map(retarget).filter((op): op is JsonPatchOp => op !== null),
    ]),
  );
  return { ...after, formatOverrides };
}
