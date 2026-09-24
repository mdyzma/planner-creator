import type { BlockInstance, LayoutNode, PageTemplate } from '@planner/schema';
import { findBlock, mapBlocks, retargetFormatOverrides } from './blocks';

/**
 * Structural edits to a page template (M6). Every function is immutable and keeps the template's
 * per-format adjustments attached to the right blocks.
 */

/** Changes one block in place. */
export function updateBlock(
  template: PageTemplate,
  id: string,
  fn: (block: BlockInstance) => BlockInstance,
): PageTemplate {
  return mapBlocks(template, (b) => (b.id === id ? fn(b) : b));
}

export function removeBlock(template: PageTemplate, id: string): PageTemplate {
  return retargetFormatOverrides(
    template,
    mapBlocks(template, (b) => (b.id === id ? null : b)),
  );
}

/** Applies `fn` to the children list of the stack or row that holds block `id`. */
function editContainer(
  node: LayoutNode,
  id: string,
  fn: (children: LayoutNode[], index: number) => LayoutNode[],
): LayoutNode {
  if (node.kind === 'block') return node;
  const index = node.children.findIndex((c) => c.kind === 'block' && c.block.id === id);
  if (index >= 0) return { ...node, children: fn(node.children, index) };
  return { ...node, children: node.children.map((c) => editContainer(c, id, fn)) };
}

function editRegion(
  template: PageTemplate,
  id: string,
  fn: <T>(items: T[], index: number, wrap: (b: BlockInstance) => T) => T[],
): PageTemplate {
  const entry = findBlock(template, id);
  if (!entry) return template;
  let next: PageTemplate;
  if (entry.region === 'body') {
    const body =
      template.body.kind === 'block'
        ? // A body that is a single block: put it in a stack so it can have siblings.
          editContainer({ kind: 'stack', gap: 4, children: [template.body] }, id, (c, i) =>
            fn(c, i, (block) => ({ kind: 'block', block })),
          )
        : editContainer(template.body, id, (c, i) =>
            fn(c, i, (block) => ({ kind: 'block', block })),
          );
    next = { ...template, body };
  } else {
    const list = template[entry.region] ?? [];
    next = { ...template, [entry.region]: fn(list, entry.index, (b) => b) };
  }
  return retargetFormatOverrides(template, next);
}

/**
 * Adds a block right after block `after` (in the same stack, row or rail), or at the end of the
 * page body when `after` is not given or not found.
 */
export function insertBlock(
  template: PageTemplate,
  block: BlockInstance,
  after?: string,
): PageTemplate {
  if (after && findBlock(template, after)) {
    return editRegion(template, after, (items, index, wrap) => [
      ...items.slice(0, index + 1),
      wrap(block),
      ...items.slice(index + 1),
    ]);
  }
  const node: LayoutNode = { kind: 'block', block };
  const body: LayoutNode =
    template.body.kind === 'stack'
      ? { ...template.body, children: [...template.body.children, node] }
      : { kind: 'stack', gap: 4, children: [template.body, node] };
  return retargetFormatOverrides(template, { ...template, body });
}

/** Moves a block to position `to` among its siblings (clamped). */
export function moveBlock(template: PageTemplate, id: string, to: number): PageTemplate {
  return editRegion(template, id, (items, from) => {
    const target = Math.max(0, Math.min(items.length - 1, to));
    if (target === from) return items;
    const copy = [...items];
    const [moved] = copy.splice(from, 1);
    copy.splice(target, 0, moved!);
    return copy;
  });
}
