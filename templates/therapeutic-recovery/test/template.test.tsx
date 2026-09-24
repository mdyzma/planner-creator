import { createDefaultRegistry } from '@planner/blocks';
import { resolveTemplateForFormat } from '@planner/core';
import { scanTranslations } from '@planner/i18n';
import { emptyRenderContext } from '@planner/renderer';
import type { BlockInstance, LayoutNode, PageTemplate, SectionTemplate } from '@planner/schema';
import {
  FORMAT_IDS,
  LOCALES,
  createProject,
  parseContentLibrary,
  parseTemplate,
} from '@planner/schema';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { serializeTemplate, therapeuticRecoveryTemplate as template } from '../src/template';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const blocksOf = (page: PageTemplate): BlockInstance[] => {
  const walk = (n: LayoutNode): BlockInstance[] =>
    n.kind === 'block' ? [n.block] : n.children.flatMap(walk);
  return [...walk(page.body), ...(page.outerRail ?? []), ...(page.free ?? [])];
};

describe('therapeutic recovery template', () => {
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

  it.each(cases)(
    '%s (%s): every block is a known type with valid props, applied cleanly',
    (_, format, page) => {
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
    },
  );

  it('is fully translated, including the bundled quotes', () => {
    const quotes = parseContentLibrary(JSON.parse(read('../content/quotes.json')));
    if (!quotes.ok) throw new Error('quotes.json is invalid');
    const project = {
      ...createProject({
        id: 'p',
        name: 'P',
        format: 'A4',
        locale: 'pl',
        now: '2026-01-01T00:00:00.000Z',
        template,
      }),
      content: [quotes.value],
    };
    const report = scanTranslations(project);
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

describe('bundled quotes', () => {
  it('can ship: both languages, fits the quote box, original or public-domain, no duplicates', async () => {
    const { validateItems } = await import('@planner/content');
    const quotes = parseContentLibrary(JSON.parse(read('../content/quotes.json')));
    if (!quotes.ok) throw new Error('quotes.json is invalid');
    const errors = validateItems(quotes.value.items, { forShipping: true }).filter(
      (i) => i.severity === 'error',
    );
    expect(errors).toEqual([]);
  });
});
