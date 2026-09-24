import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlannerProject } from '@planner/schema';
import type { Browser } from 'playwright-core';
import { chromium } from 'playwright-core';
import { serveStatic } from './static';

/** Same shape as the web app's `ExportPayload` (apps/web/src/lib/exportPayload.ts). */
export interface RenderRequest {
  project: PlannerProject;
  from: number;
  to: number;
  padAfter: number;
}

export interface Renderer {
  render(request: RenderRequest): Promise<Uint8Array>;
  close(): Promise<void>;
}

export interface RendererOptions {
  /** A running web app to load instead of the static build, e.g. http://localhost:3000. */
  webUrl?: string;
  /** Static build directory; defaults to apps/web/out. */
  outDir?: string;
  /** Chrome or Chromium to use; defaults to the installed Google Chrome. */
  executablePath?: string;
  /** Pages rendered at the same time. */
  concurrency?: number;
}

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT_DIR = join(here, '..', '..', 'web', 'out');

/** Finds a Chrome to drive: `CHROME_PATH`, else Playwright's "chrome" channel lookup. */
function launchOptions(executablePath?: string) {
  const path = executablePath ?? process.env.CHROME_PATH;
  if (path) {
    if (!existsSync(path)) throw new Error(`CHROME_PATH does not exist: ${path}`);
    return { executablePath: path };
  }
  return { channel: 'chrome' as const };
}

/**
 * Renders printed pages to PDF in headless Chrome (§8.3). The project is injected before the
 * print route loads, so nothing is sent anywhere or written to disk; the route renders the
 * requested pages with the same code as the preview and marks itself ready when fonts are in.
 */
export async function createRenderer(options: RendererOptions = {}): Promise<Renderer> {
  const site = options.webUrl
    ? { url: options.webUrl.replace(/\/$/, ''), close: async () => {} }
    : await serveStatic(options.outDir ?? DEFAULT_OUT_DIR);
  let browser: Browser;
  try {
    browser = await chromium.launch({ ...launchOptions(options.executablePath), headless: true });
  } catch (e) {
    await site.close();
    throw new Error(
      `Could not start Chrome. Install Google Chrome or set CHROME_PATH. (${e instanceof Error ? e.message.split('\n')[0] : e})`,
      { cause: e },
    );
  }

  const limit = Math.max(1, options.concurrency ?? 2);
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = async () => {
    if (active >= limit) await new Promise<void>((go) => waiting.push(go));
    active++;
  };
  const release = () => {
    active--;
    waiting.shift()?.();
  };

  const render = async (request: RenderRequest): Promise<Uint8Array> => {
    await acquire();
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.addInitScript((json: string) => {
        (window as unknown as { __PLANNER_EXPORT__: unknown }).__PLANNER_EXPORT__ =
          JSON.parse(json);
      }, JSON.stringify(request));
      const locale = request.project.locale;
      await page.goto(`${site.url}/${locale}/print`, { waitUntil: 'load' });
      await page.waitForSelector('html[data-export-ready="true"]', { timeout: 120_000 });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      return new Uint8Array(pdf);
    } finally {
      await context.close();
      release();
    }
  };

  return {
    render,
    close: async () => {
      await browser.close();
      await site.close();
    },
  };
}
