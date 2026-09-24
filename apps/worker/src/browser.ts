import type { Browser } from '@cloudflare/puppeteer';
import puppeteer from '@cloudflare/puppeteer';
import { EXPORT_READY_SELECTOR, printRoute } from '@planner/pdf/request';
import type { RenderPdf } from './handler';

/** Idle browsers stay up this long, so the parts of one export share a browser. */
const KEEP_ALIVE_MS = 60_000;

/** Connects to an idle Browser Run session if there is one, else starts a new one. */
async function acquire(endpoint: Fetcher): Promise<Browser> {
  try {
    const sessions = await puppeteer.sessions(endpoint);
    for (const s of sessions) {
      if (s.connectionId) continue;
      try {
        return await puppeteer.connect(endpoint, s.sessionId);
      } catch {
        // Another request took it first.
      }
    }
  } catch {
    // Listing sessions is an optimisation; fall through to a new browser.
  }
  return puppeteer.launch(endpoint, { keep_alive: KEEP_ALIVE_MS });
}

/**
 * Renders the print route in Browser Run (ADR-0004). The planner is injected before the page's
 * scripts run, exactly as the local service does with Playwright.
 */
export const renderWithBrowserRun: RenderPdf = async (env, origin, request) => {
  if (!env.BROWSER) throw new Error('no browser binding');
  const browser = await acquire(env.BROWSER);
  try {
    const page = await browser.newPage();
    try {
      // Runs in the page, where globalThis is the window.
      await page.evaluateOnNewDocument((json: string) => {
        (globalThis as unknown as { __PLANNER_EXPORT__: unknown }).__PLANNER_EXPORT__ =
          JSON.parse(json);
      }, JSON.stringify(request));
      await page.goto(new URL(printRoute(request), origin).href, { waitUntil: 'load' });
      await page.waitForSelector(EXPORT_READY_SELECTOR, { timeout: 60_000 });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      return new Uint8Array(pdf);
    } finally {
      await page.close();
    }
  } finally {
    // Leave the browser running for the next part; it closes itself when idle.
    browser.disconnect();
  }
};
