import type { Browser } from 'playwright-core';
import { chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveStatic } from '../src/static';

/**
 * Offline use (PWA): after one visit, the built app (`pnpm --filter @planner/web build`) opens
 * and works with no connection, its pages served by the service worker from the browser's cache.
 */

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

describe('offline use', () => {
  it('is installable: a manifest with icons', async () => {
    const res = await fetch(`${site.url}/manifest.webmanifest`);
    expect(res.headers.get('content-type')).toContain('application/manifest+json');
    const manifest = (await res.json()) as { name: string; icons: { src: string }[] };
    expect(manifest.name).toContain('YAPCO');
    for (const icon of manifest.icons)
      expect((await fetch(`${site.url}${icon.src}`)).ok).toBe(true);
  });

  it('opens the planners, the designer and the guide without a connection', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${site.url}/pl`, { waitUntil: 'load' });
    // The worker installs (caching the whole app) and takes control of the page.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
        );
      }
    });

    await context.setOffline(true);
    for (const [path, text] of [
      ['/pl', 'Nowy planer'],
      ['/pl/editor?id=missing', 'Nie znaleziono planera'],
      ['/pl/guide?edition=balance', 'Jak wypełniać planer'],
      ['/en', 'New planner'],
    ] as const) {
      await page.goto(`${site.url}${path}`, { waitUntil: 'load' });
      await expect(
        page.getByText(text).first().waitFor({ timeout: 10_000 }),
      ).resolves.toBeUndefined();
    }

    // A new planner is made and saved in the browser, and opens in the designer, all offline.
    await page.goto(`${site.url}/pl`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Utwórz planer' }).click();
    await page.waitForURL(/\/pl\/editor\?id=/);
    await page.locator('[data-block-id]').first().waitFor({ timeout: 15_000 });
    await context.close();
  });
});
