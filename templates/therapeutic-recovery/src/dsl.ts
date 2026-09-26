import type { BlockInstance, LayoutNode, Length, LocalizedText } from '@planner/schema';

/** Small helpers for authoring templates in TypeScript; the output is plain template JSON. */

export const L = (en: string, pl: string): LocalizedText => ({ en, pl });
export const mmH = (mm: number): Length => ({ mm });
export const fr = (n = 1): Length => ({ fr: n });

export const block = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  size: { height?: Length; width?: Length } = {},
): LayoutNode => ({
  kind: 'block',
  block: {
    id,
    type,
    props: props as BlockInstance['props'],
    ...(size.height || size.width ? { size } : {}),
  },
});

export const railBlock = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  height?: Length,
): BlockInstance => ({
  id,
  type,
  props: props as BlockInstance['props'],
  ...(height ? { size: { height } } : {}),
});

export const stack = (
  children: LayoutNode[],
  opts: { height?: Length; width?: Length; label?: LocalizedText; gap?: number } = {},
): LayoutNode => ({
  kind: 'stack',
  gap: opts.gap ?? 4,
  children,
  ...(opts.height ? { height: opts.height } : {}),
  ...(opts.width ? { width: opts.width } : {}),
  ...(opts.label ? { label: opts.label } : {}),
});

export const row = (
  children: LayoutNode[],
  opts: { height?: Length; gap?: number } = {},
): LayoutNode => ({
  kind: 'row',
  gap: opts.gap ?? 5,
  children,
  ...(opts.height ? { height: opts.height } : {}),
});

/** JSON pointer to a block inside a page template, found by id (for format overrides). */
export function pointerToBlock(node: LayoutNode, id: string, base = '/body'): string | undefined {
  if (node.kind === 'block') return node.block.id === id ? `${base}/block` : undefined;
  for (let i = 0; i < node.children.length; i++) {
    const found = pointerToBlock(node.children[i]!, id, `${base}/children/${i}`);
    if (found) return found;
  }
  return undefined;
}
