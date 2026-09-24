import type { BlockRenderContext, BlockRenderer } from '@planner/renderer';
import { PAPER, mm } from '@planner/renderer';
import type { BlockInstance, LocalizedText } from '@planner/schema';
import type { ReactNode } from 'react';
import type { z } from 'zod';

/** Declarative description of a property, from which the editor builds its panel (M6). */
export type InspectorField =
  | { key: string; kind: 'localized-text'; label: LocalizedText; multiline?: boolean }
  | { key: string; kind: 'localized-list'; label: LocalizedText }
  | { key: string; kind: 'number'; label: LocalizedText; min: number; max: number; step?: number }
  | {
      key: string;
      kind: 'select';
      label: LocalizedText;
      options: { value: string; label: LocalizedText }[];
    }
  | { key: string; kind: 'boolean'; label: LocalizedText };

export type BlockCategory = 'text' | 'writing' | 'tracking' | 'calendar' | 'therapeutic' | 'layout';

/**
 * One block type (§6). Adding a planner widget means adding one definition; core code never
 * switches on block types.
 */
export interface BlockDefinition<P = unknown> {
  type: string;
  version: number;
  label: LocalizedText;
  category: BlockCategory;
  /** Validates props after defaults are merged in. */
  propsSchema: z.ZodType<P>;
  defaults: P;
  inspector: InspectorField[];
  Render: (args: { props: P; block: BlockInstance; ctx: BlockRenderContext }) => ReactNode;
}

/** Erases the props type so definitions of different blocks can share one list. */
export const defineBlock = <P,>(def: BlockDefinition<P>): BlockDefinition<unknown> =>
  def as unknown as BlockDefinition<unknown>;

export interface BlockRegistry {
  definitions: readonly BlockDefinition<unknown>[];
  get(type: string): BlockDefinition<unknown> | undefined;
  render: BlockRenderer;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function Problem({ ctx, text }: { ctx: BlockRenderContext; text: string }) {
  // Never print diagnostics: in print mode a broken block leaves blank space.
  if (ctx.mode === 'print') return null;
  return (
    <div
      role="note"
      style={{
        height: '100%',
        boxSizing: 'border-box',
        border: `${mm(0.3)} dashed #9b1c1c`,
        padding: mm(1.5),
        fontSize: '7pt',
        color: '#9b1c1c',
      }}
    >
      {text}
    </div>
  );
}

export function createBlockRegistry(
  definitions: readonly BlockDefinition<unknown>[],
): BlockRegistry {
  const byType = new Map(definitions.map((d) => [d.type, d]));
  if (byType.size !== definitions.length) throw new Error('Duplicate block type in registry.');

  const render: BlockRenderer = (block, ctx) => {
    const def = byType.get(block.type);
    if (!def)
      return <Problem ctx={ctx} text={`Unknown block type “${block.type}” (${block.id})`} />;
    const merged = { ...(def.defaults as object), ...(isRecord(block.props) ? block.props : {}) };
    const parsed = def.propsSchema.safeParse(merged);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return (
        <Problem
          ctx={ctx}
          text={`${block.type} (${block.id}): ${issue?.path.join('.')} ${issue?.message}`}
        />
      );
    }
    return (
      <div
        data-block-type={block.type}
        data-block-id={block.id}
        style={{ height: '100%', width: '100%', color: PAPER.ink, position: 'relative' }}
      >
        <def.Render props={parsed.data} block={block} ctx={ctx} />
      </div>
    );
  };

  return { definitions, get: (type) => byType.get(type), render };
}
