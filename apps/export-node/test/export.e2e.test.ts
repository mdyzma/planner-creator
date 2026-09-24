import { generate } from '@planner/generator';
import { PDFDocument } from 'pdf-lib';
import type { PlannerProject } from '@planner/schema';
import { createProject, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportPlanner } from '../src/pipeline';
import type { Renderer } from '../src/render';
import { DEFAULT_OUT_DIR, createRenderer } from '../src/render';
import { serveStatic } from '../src/static';

/**
 * M7 exit criteria, on real PDFs from Chrome (needs `pnpm --filter @planner/web build` and an
 * installed Chrome, or CHROME_PATH):
 * - page box 595.28 × 841.89 pt (A4) / 419.53 × 595.28 pt (A5) ± 0.01;
 * - punched ring holes clear all content.
 */

const template = parseTemplate(templateJson);
const quotes = parseContentLibrary(quotesJson);
if (!template.ok || !quotes.ok) throw new Error('fixtures invalid');

function planner(format: 'A4' | 'A5'): PlannerProject {
  const p = createProject({
    id: `e2e-${format}`,
    name: `E2E ${format}`,
    format,
    locale: 'pl',
    now: '2026-09-24T00:00:00.000Z',
    template: template.ok ? template.value : (undefined as never),
  });
  const content = [quotes.ok ? quotes.value : (undefined as never)];
  const generation = { ...p.generation, startDate: '2026-10-01', durationMonths: 1 };
  const { document } = generate({
    template: p.template,
    config: generation,
    content,
    seed: p.id,
    profile: p.print.profile,
  });
  return { ...p, content, generation, document };
}

const round = (v: number) => Math.round(v * 100) / 100;
const sizes = (doc: PDFDocument) =>
  new Set(doc.getPages().map((p) => `${round(p.getWidth())}x${round(p.getHeight())}`));

let renderer: Renderer;
beforeAll(async () => {
  renderer = await createRenderer({ concurrency: 3 });
});
afterAll(() => renderer?.close());

describe('PDF export in Chrome', () => {
  it('prints A4 pages at exactly 595.28 × 841.89 pt, one per planned page', async () => {
    const [file] = await exportPlanner(renderer, planner('A4'), { profile: 'home-duplex' });
    const doc = await PDFDocument.load(file!.bytes);
    expect(sizes(doc)).toEqual(new Set(['595.28x841.89']));
    expect(doc.getPageCount()).toBe(file!.pageCount);
    expect(doc.getPageCount() % 2).toBe(0);
  });

  it('prints A5 pages at 419.53 × 595.28 pt, and 2-up on A4 landscape', async () => {
    const project = planner('A5');
    const [native] = await exportPlanner(renderer, project, { profile: 'home-a5-native' });
    expect(sizes(await PDFDocument.load(native!.bytes))).toEqual(new Set(['419.53x595.28']));

    const [twoUp] = await exportPlanner(renderer, project, {
      profile: 'home-a5-2up',
      section: 'month:2026-10',
    });
    const sheets = await PDFDocument.load(twoUp!.bytes);
    expect(sizes(sheets)).toEqual(new Set(['841.89x595.28']));
    expect(sheets.getPageCount() % 2).toBe(0);
  });

  it('keeps every block clear of the punched holes', async () => {
    for (const format of ['A4', 'A5'] as const) {
      const project = planner(format);
      const ring = project.print.binding;
      if (ring.kind !== 'ring') throw new Error('expected ring binding');
      // The hole's outer edge, measured from the binding edge.
      const keepOut = ring.holeCentreFromEdge + ring.holeDiameter / 2;

      const site = await serveStatic(DEFAULT_OUT_DIR);
      const browser = await chromium.launch(
        process.env.CHROME_PATH
          ? { executablePath: process.env.CHROME_PATH }
          : { channel: 'chrome' },
      );
      try {
        const page = await browser.newPage();
        await page.addInitScript(
          (json: string) => {
            (window as unknown as { __PLANNER_EXPORT__: unknown }).__PLANNER_EXPORT__ =
              JSON.parse(json);
          },
          JSON.stringify({ project, from: 0, to: 60, padAfter: 0 }),
        );
        await page.goto(`${site.url}/pl/print`);
        await page.waitForSelector('html[data-export-ready="true"]');
        const closest = await page.evaluate(() => {
          const pxPerMm = 96 / 25.4;
          let min = Infinity;
          for (const p of document.querySelectorAll<HTMLElement>('.planner-print-page')) {
            const box = p.getBoundingClientRect();
            const bindingLeft = p.dataset.pageSide === 'right';
            for (const b of p.querySelectorAll<HTMLElement>('[data-block-id]')) {
              const r = b.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              const gap = bindingLeft ? r.left - box.left : box.right - r.right;
              min = Math.min(min, gap / pxPerMm);
            }
          }
          return min;
        });
        expect(closest).toBeGreaterThanOrEqual(keepOut);
      } finally {
        await browser.close();
        await site.close();
      }
    }
  });
});
