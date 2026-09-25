import type {
  BlockInstance,
  BlockVariant,
  Condition,
  GenerationConfig,
  PlannerTemplate,
} from '@planner/schema';
import { evaluateCondition } from './condition';

type ModuleSource = Pick<PlannerTemplate, 'modules'>;

/**
 * Every module of the template, on or off (ADR-0010): the planner's choice where it made one,
 * the template's default otherwise. Planners made before modules existed have no choices, so
 * they get the defaults and print as before.
 */
export function effectiveModules(
  template: ModuleSource,
  config: Pick<GenerationConfig, 'modules'>,
): Record<string, boolean> {
  const modules: Record<string, boolean> = {};
  for (const m of template.modules ?? []) modules[m.id] = config.modules?.[m.id] ?? m.default;
  return modules;
}

/**
 * The generation settings as conditions see them, `{ var: "config.modules.recovery" }`
 * included. Use it for every condition scope, so pages and blocks agree.
 */
export const conditionConfig = <C extends Pick<GenerationConfig, 'modules'>>(
  template: ModuleSource,
  config: C,
): C & { modules: Record<string, boolean> } => ({
  ...config,
  modules: effectiveModules(template, config),
});

/** The preset whose modules match these exactly, if any ("custom" otherwise). */
export function matchingPreset(
  template: Pick<PlannerTemplate, 'modules' | 'presets'>,
  modules: Readonly<Record<string, boolean>>,
): string | undefined {
  return template.presets?.find((p) =>
    (template.modules ?? []).every((m) => (p.modules[m.id] ?? m.default) === modules[m.id]),
  )?.id;
}

/** Holds while the module is on (or not decided: a missing choice never hides anything). */
export const moduleOn = (id: string): Condition => ({
  '!=': [{ var: `config.modules.${id}` }, false],
});

/** Holds while the module is switched off. */
export const moduleOff = (id: string): Condition => ({
  '==': [{ var: `config.modules.${id}` }, false],
});

/** The first of the block's variants whose condition holds in this scope. */
export const activeVariant = (
  block: Pick<BlockInstance, 'variants'>,
  scope: Readonly<Record<string, unknown>>,
): { variant: BlockVariant; index: number } | undefined => {
  const index = block.variants?.findIndex((v) => evaluateCondition(v.when, scope)) ?? -1;
  return index >= 0 ? { variant: block.variants![index]!, index } : undefined;
};
