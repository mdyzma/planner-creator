import type { PageTemplate, PlannerTemplate } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import {
  conditionConfig,
  conditionParts,
  effectiveModules,
  evaluateCondition,
  matchingPreset,
  moduleOff,
  moduleOn,
  resolvePageTemplate,
} from '../src';

const L = (en: string, pl: string) => ({ en, pl });

const template: Pick<PlannerTemplate, 'modules' | 'presets'> = {
  modules: [
    { id: 'recovery', name: L('Recovery', 'Zdrowienie'), description: L('', ''), default: true },
    { id: 'cbt', name: L('CBT', 'CBT'), description: L('', ''), default: false },
  ],
  presets: [
    {
      id: 'recovery-edition',
      name: L('Recovery Edition', 'Recovery Edition'),
      description: L('', ''),
      modules: { recovery: true, cbt: false },
    },
    {
      id: 'balance',
      name: L('Balance', 'Balance'),
      description: L('', ''),
      modules: { recovery: false, cbt: false },
    },
  ],
};

describe('modules', () => {
  it('takes the planner’s choices and the template’s defaults for the rest', () => {
    expect(effectiveModules(template, {})).toEqual({ recovery: true, cbt: false });
    expect(effectiveModules(template, { modules: { cbt: true } })).toEqual({
      recovery: true,
      cbt: true,
    });
    expect(effectiveModules({}, { modules: { recovery: false } })).toEqual({});
  });

  it('names the preset that matches, or none for a custom choice', () => {
    expect(matchingPreset(template, { recovery: true, cbt: false })).toBe('recovery-edition');
    expect(matchingPreset(template, { recovery: false, cbt: false })).toBe('balance');
    expect(matchingPreset(template, { recovery: true, cbt: true })).toBeUndefined();
  });

  it('never hides content for a missing choice', () => {
    const scope = (modules?: Record<string, boolean>) => ({ config: { modules } });
    expect(evaluateCondition(moduleOn('recovery'), scope())).toBe(true);
    expect(evaluateCondition(moduleOff('recovery'), scope())).toBe(false);
    expect(evaluateCondition(moduleOn('recovery'), scope({ recovery: false }))).toBe(false);
    expect(evaluateCondition(moduleOff('recovery'), scope({ recovery: false }))).toBe(true);
  });

  it('prints a block’s variant while its condition holds, under a page’s own change', () => {
    const page: PageTemplate = {
      id: 'day',
      name: L('Day', 'Dzień'),
      body: {
        kind: 'block',
        block: {
          id: 'commitment',
          type: 'writing-area',
          props: { title: L('Protect my sobriety', 'Chronię trzeźwość'), pattern: 'lines' },
          variants: [
            { when: moduleOff('recovery'), props: { title: L('Take care', 'Dbam o siebie') } },
          ],
        },
      },
    };
    const props = (modules: Record<string, boolean>, overrides = {}) => {
      const scope = { config: conditionConfig(template, { modules }) };
      const { template: t } = resolvePageTemplate(page, {
        format: 'A4',
        side: 'left',
        scope,
        overrides,
      });
      return t.body.kind === 'block' ? (t.body.block.props as Record<string, unknown>) : {};
    };
    expect(props({})).toMatchObject({ title: { pl: 'Chronię trzeźwość' }, pattern: 'lines' });
    expect(props({ recovery: false })).toMatchObject({
      title: { pl: 'Dbam o siebie' },
      pattern: 'lines',
    });
    const own = { commitment: { props: { title: L('Mine', 'Moje') } } };
    expect(props({ recovery: false }, own)).toMatchObject({ title: { pl: 'Moje' } });
  });

  it('swaps in the examples of a matching example variant, block by block', () => {
    const page: PageTemplate = {
      id: 'day',
      name: L('Day', 'Dzień'),
      body: { kind: 'block', block: { id: 'plan', type: 'writing-area', props: {} } },
      sampleContent: { plan: { fill: 'meeting' }, gratitude: { fill: '42 days' } },
      sampleVariants: [{ when: moduleOff('recovery'), content: { plan: { fill: 'pool' } } }],
    };
    const samples = (modules: Record<string, boolean>) =>
      resolvePageTemplate(page, {
        format: 'A4',
        side: 'left',
        scope: { config: conditionConfig(template, { modules }) },
      }).template;
    expect(samples({}).sampleContent).toEqual(page.sampleContent);
    expect(samples({ recovery: false }).sampleContent).toEqual({
      plan: { fill: 'pool' },
      gratitude: { fill: '42 days' },
    });
    expect(samples({}).sampleVariants).toBeUndefined();
  });

  it('drops a column whose blocks are all left out, so it takes no space', () => {
    const block = (id: string) =>
      ({ kind: 'block', block: { id, type: 'text', props: {} } }) as const;
    const page: PageTemplate = {
      id: 'day',
      name: L('Day', 'Dzień'),
      body: {
        kind: 'row',
        gap: 5,
        children: [
          block('priorities'),
          {
            kind: 'stack',
            gap: 2,
            children: [
              { kind: 'block', block: { ...block('extra').block, visibility: moduleOn('x') } },
            ],
          },
        ],
      },
    };
    const body = (modules: Record<string, boolean>) =>
      resolvePageTemplate(page, {
        format: 'A4',
        side: 'left',
        scope: { config: { modules } },
      }).template.body;
    const row = (b: PageTemplate['body']) => (b.kind === 'row' ? b.children.length : -1);
    expect(row(body({ x: true }))).toBe(2);
    expect(row(body({ x: false }))).toBe(1);
  });

  it('reads a module or format condition as parts, for the designer', () => {
    expect(conditionParts(moduleOff('recovery'))).toEqual([{ module: 'recovery', on: false }]);
    expect(
      conditionParts({ and: [moduleOn('halt'), { '==': [{ var: 'format' }, 'A5'] }] }),
    ).toEqual([{ module: 'halt', on: true }, { format: 'A5' }]);
    expect(conditionParts({ '==': [{ var: 'page.side' }, 'left'] })).toBeUndefined();
  });
});
