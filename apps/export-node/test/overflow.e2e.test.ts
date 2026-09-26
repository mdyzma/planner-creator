import { generate } from '@planner/generator';
import type { FormatId, PlannerProject } from '@planner/schema';
import { createProject, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import weeklyJson from '@planner/template-weekly-planner/template.json';
import type { Browser } from 'playwright-core';
import { chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveStatic } from '../src/static';

/**
 * No printed text is cut off: every page of one month, in each edition and format, with the
 * example filling (the longest content a page gets), rendered in Chrome from the built web app
 * (`pnpm --filter @planner/web build`). A block fails when its content is larger than its box,
 * or when an element inside it that clips (overflow other than visible) hides part of its
 * content. The handwritten notes of the examples sit on block edges on purpose and are left out.
 */

const template = parseTemplate(templateJson);
const weekly = parseTemplate(weeklyJson);
const quotes = parseContentLibrary(quotesJson);
if (!template.ok || !weekly.ok || !quotes.ok) throw new Error('fixtures invalid');

const EDITIONS: Record<string, Record<string, boolean>> = {
  recovery: { start: true, recovery: true, halt: true, cbt: true, dayplus: false },
  'recovery-dayplus': { start: true, recovery: true, halt: true, cbt: false, dayplus: true },
  balance: { start: true, recovery: false, halt: true, cbt: true, dayplus: false },
  basic: { start: false, recovery: false, halt: false, cbt: false, dayplus: false },
  // Mindfulness and productivity: with everything else on, and with Balance (where the weekly
  // mindfulness page takes the place of the blank page after "My week").
  extras: {
    start: true,
    recovery: true,
    halt: true,
    cbt: true,
    dayplus: false,
    mindful: true,
    productivity: true,
  },
  'balance-extras': {
    start: true,
    recovery: false,
    halt: true,
    cbt: false,
    dayplus: false,
    mindful: true,
    productivity: true,
  },
};

function planner(
  format: FormatId,
  modules: Record<string, boolean>,
  locale: 'pl' | 'en',
  which: 'day-by-day' | 'weekly' = 'day-by-day',
): PlannerProject {
  const p = createProject({
    id: 'overflow',
    name: 'Overflow',
    format,
    locale,
    now: '2026-09-24T00:00:00.000Z',
    template:
      which === 'weekly'
        ? weekly.ok
          ? weekly.value
          : (undefined as never)
        : template.ok
          ? template.value
          : (undefined as never),
  });
  const content = which === 'weekly' ? [] : [quotes.ok ? quotes.value : (undefined as never)];
  const generation = { ...p.generation, startDate: '2026-10-01', durationMonths: 1, modules };
  const { document } = generate({
    template: p.template,
    config: generation,
    content,
    seed: p.id,
    profile: p.print.profile,
  });
  return { ...p, content, generation, document };
}

/** One line per block id: how often it overflows, by how much at most, and the first page. */
function summary(found: [number, string, number, number][]): string[] {
  const byBlock = new Map<string, { n: number; dx: number; dy: number; first: number }>();
  for (const [page, id, dx, dy] of found) {
    const s = byBlock.get(id) ?? { n: 0, dx: 0, dy: 0, first: page };
    byBlock.set(id, { n: s.n + 1, dx: Math.max(s.dx, dx), dy: Math.max(s.dy, dy), first: s.first });
  }
  return [...byBlock].map(
    ([id, s]) =>
      `${id} ×${s.n}: up to +${s.dx} mm wide, +${s.dy} mm tall (first on page ${s.first})`,
  );
}

/** Overflowing blocks on the page: page number, block id, overflow in mm. */
function findOverflow(): [number, string, number, number][] {
  const PX_PER_MM = 96 / 25.4;
  const TOLERANCE = 0.6 * PX_PER_MM;
  for (const note of document.querySelectorAll<HTMLElement>('[data-sample-note]'))
    note.style.display = 'none';
  const found: [number, string, number, number][] = [];
  document.querySelectorAll('[data-page-side]').forEach((page, index) => {
    page.querySelectorAll<HTMLElement>('[data-block-id]').forEach((block) => {
      const clipping = [...block.querySelectorAll<HTMLElement>('*')].filter((el) => {
        const s = getComputedStyle(el);
        return s.overflowX !== 'visible' || s.overflowY !== 'visible';
      });
      for (const el of [block, ...clipping]) {
        const dx = el.scrollWidth - el.clientWidth;
        const dy = el.scrollHeight - el.clientHeight;
        if (dx > TOLERANCE || dy > TOLERANCE) {
          const mm = (v: number) => Math.round(Math.max(0, v / PX_PER_MM) * 10) / 10;
          found.push([index + 1, block.dataset.blockId ?? '?', mm(dx), mm(dy)]);
          break;
        }
      }
    });
  });
  return found;
}

let browser: Browser;
let site: Awaited<ReturnType<typeof serveStatic>>;
beforeAll(async () => {
  site = await serveStatic('../web/out');
  browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: 'chrome' }),
  });
});
afterAll(async () => {
  await browser?.close();
  await site?.close();
});

describe('no printed text is cut off', () => {
  const runs = [
    ...Object.keys(EDITIONS).map((edition) => [edition, 'pl'] as const),
    ['recovery', 'en'] as const,
    ['balance', 'en'] as const,
    ['balance-extras', 'en'] as const,
    // The second template, "Week by Week": no modules.
    ['weekly', 'pl'] as const,
    ['weekly', 'en'] as const,
  ];
  for (const [edition, locale] of runs) {
    for (const format of ['A4', 'A5'] as const) {
      it(`${edition}, ${format}, ${locale}, with examples`, async () => {
        const project =
          edition === 'weekly'
            ? planner(format, {}, locale, 'weekly')
            : planner(format, EDITIONS[edition]!, locale);
        const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
        await page.addInitScript(
          (json: string) => {
            (globalThis as { __PLANNER_EXPORT__?: unknown }).__PLANNER_EXPORT__ = JSON.parse(json);
          },
          JSON.stringify({ project, from: 0, to: 9999, padAfter: 0, samples: true }),
        );
        await page.goto(`${site.url}/${locale}/print`, { waitUntil: 'load' });
        await page.waitForSelector('[data-page-side]');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const found = await page.evaluate(findOverflow);
        await page.close();
        expect(summary(found)).toEqual([]);
      });
    }
  }
});
