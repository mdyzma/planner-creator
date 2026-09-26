import { createDefaultRegistry } from '@planner/blocks';
import { resolveTemplateForFormat } from '@planner/core';
import { generate } from '@planner/generator';
import { scanTranslations } from '@planner/i18n';
import { emptyRenderContext } from '@planner/renderer';
import type {
  BlockInstance,
  LayoutNode,
  PageInstance,
  PageTemplate,
  SectionNode,
  SectionTemplate,
} from '@planner/schema';
import { FORMAT_IDS, LOCALES, createProject, isPageInstance, parseTemplate } from '@planner/schema';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { serializeTemplate, weeklyPlannerTemplate as template } from '../src/template';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const blocksOf = (page: PageTemplate): BlockInstance[] => {
  const walk = (n: LayoutNode): BlockInstance[] =>
    n.kind === 'block' ? [n.block] : n.children.flatMap(walk);
  return [...walk(page.body), ...(page.outerRail ?? []), ...(page.free ?? [])];
};

const pagesOf = (node: SectionNode): PageInstance[] =>
  node.children.flatMap((c) => (isPageInstance(c) ? [c] : pagesOf(c)));

const project = (startDate?: string) => {
  const p = createProject({
    id: 'w',
    name: 'W',
    format: 'A4',
    locale: 'pl',
    now: '2026-01-01T00:00:00.000Z',
    template,
  });
  // The template's own defaults, as the new-planner form uses them: a year, no quotes.
  return { ...p, generation: { ...p.generation, ...template.defaults.generation, startDate } };
};

describe('weekly planner template', () => {
  it('template.json is up to date with src/template.ts (run pnpm build:template)', () => {
    expect(read('../template.json')).toBe(serializeTemplate(template));
  });

  it('matches the planner template schema', () => {
    const parsed = parseTemplate(JSON.parse(read('../template.json')));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues, null, 2));
  });

  const registry = createDefaultRegistry();
  const cases = Object.values(template.pageTemplates).flatMap((page) =>
    FORMAT_IDS.map((format) => [page.id, format, page] as const),
  );

  it.each(cases)('%s (%s): every block is a known type with valid props', (_, format, page) => {
    const { template: resolved, warnings } = resolveTemplateForFormat(page, format);
    expect(warnings).toEqual([]);
    for (const locale of LOCALES) {
      for (const block of blocksOf(resolved)) {
        const html = renderToStaticMarkup(
          <>{registry.render(block, emptyRenderContext(locale, 'preview'))}</>,
        );
        expect(html, `${page.id} › ${block.id}`).not.toContain('role="note"');
      }
    }
  });

  it('is fully translated', () => {
    const report = scanTranslations(project());
    const missing = report.entries
      .filter((e) => e.missing.length > 0)
      .map((e) => `${e.ownerId}.${e.field}`);
    expect(missing).toEqual([]);
  });

  it('has both halves of every spread and only references existing pages', () => {
    const groups = new Map<string, Set<string>>();
    for (const page of Object.values(template.pageTemplates)) {
      if (page.spread)
        groups.set(
          page.spread.group,
          (groups.get(page.spread.group) ?? new Set()).add(page.spread.position),
        );
    }
    for (const [group, sides] of groups)
      expect([...sides].sort(), group).toEqual(['left', 'right']);

    const refs = (s: SectionTemplate): string[] =>
      s.children.flatMap((c) => ('page' in c ? [c.page] : refs(c)));
    for (const id of template.sections.flatMap(refs))
      expect(template.pageTemplates[id], id).toBeDefined();
  });
});

describe('a generated year', () => {
  const p = project('2027-01-01');
  const result = generate({
    template: p.template,
    config: p.generation,
    content: [],
    seed: p.id,
    profile: p.print.profile,
  });
  const pages = pagesOf(result.document.root);
  const count = (id: string) => pages.filter((x) => x.templateId === id).length;

  it('has twelve months, each with its month spread and a notes page', () => {
    expect(count('month-left')).toBe(12);
    expect(count('month-right')).toBe(12);
    expect(count('notes')).toBe(12);
  });

  it('has a spread for every week, dated Monday to Sunday', () => {
    // Every day of the year is in a week: 1 January 2027 is a Friday, so January starts with
    // the week of Monday 28 December, and the year has 53 week spreads.
    expect(count('week-left')).toBe(53);
    expect(count('week-right')).toBe(53);
    const first = pages.find((x) => x.templateId === 'week-left')!;
    expect(first.context.dates).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
});
