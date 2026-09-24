import type { ContentLibrary, PageInstance, SectionNode } from '@planner/schema';
import { createProject, isPageInstance, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, generate, measureContent, redealContent } from '../src';

const template = parseTemplate(templateJson);
const quotes = parseContentLibrary(quotesJson);
if (!template.ok || !quotes.ok) throw new Error('fixtures invalid');

const pagesOf = (node: SectionNode): PageInstance[] =>
  node.children.flatMap((c) => (isPageInstance(c) ? [c] : pagesOf(c)));

const project = createProject({
  id: 'p',
  name: 'P',
  format: 'A4',
  locale: 'pl',
  now: '2026-09-24T00:00:00.000Z',
  template: template.value,
});
const config = { ...project.generation, startDate: '2026-10-01' };
const { document } = generate({
  template: template.value,
  config,
  content: [quotes.value],
  seed: 'p',
});

describe('measureContent', () => {
  it('reports what is actually on the pages', () => {
    const coverage = measureContent(document.root, [quotes.value]);
    expect(coverage).toEqual({ slots: 182, available: 12, maxUses: 16, minGap: 12, missing: 0 });
  });

  it('counts pages that point at deleted items', () => {
    const smaller: ContentLibrary = { ...quotes.value, items: quotes.value.items.slice(1) };
    const coverage = measureContent(document.root, [smaller]);
    const deletedId = quotes.value.items[0]!.id;
    const onPages = pagesOf(document.root).filter(
      (p) => p.contentAssignments?.quote === deletedId,
    ).length;
    expect(onPages).toBeGreaterThan(0);
    expect(coverage.missing).toBe(onPages);
  });
});

describe('redealContent', () => {
  it('deals a grown library so repeats move further apart, keeping everything else', () => {
    const extra = Array.from({ length: 48 }, (_, i) => ({
      ...quotes.value.items[0]!,
      id: `q-${String(i + 100).padStart(4, '0')}`,
      text: { en: `Extra ${i}`, pl: `Dodatkowa ${i}` },
    }));
    const grown: ContentLibrary = { ...quotes.value, items: [...quotes.value.items, ...extra] };
    const { root, report } = redealContent(document.root, {
      template: template.value,
      libraries: [grown],
      cadence: 'daily',
      seed: 'p',
      bindings: DEFAULT_BINDINGS,
    });
    expect(report).toMatchObject({ slots: 182, available: 60, maxUses: 4, minGap: 60 });
    expect(pagesOf(root).map((p) => p.key)).toEqual(pagesOf(document.root).map((p) => p.key));
    expect(measureContent(root, [grown]).missing).toBe(0);
  });

  it('clears quotes when the cadence becomes "none"', () => {
    const { root } = redealContent(document.root, {
      template: template.value,
      libraries: [quotes.value],
      cadence: 'none',
      seed: 'p',
      bindings: DEFAULT_BINDINGS,
    });
    expect(pagesOf(root).some((p) => p.contentAssignments)).toBe(false);
  });
});
