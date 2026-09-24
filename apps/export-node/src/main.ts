import { parseArgs } from 'node:util';
import { createRenderer } from './render';
import { createExportServer } from './server';

/**
 * Starts the local export service: `pnpm --filter @planner/export-node serve`.
 *
 * EXPORT_PORT             port on 127.0.0.1 (default 8787)
 * EXPORT_ALLOWED_ORIGINS  comma-separated web app origins (default http://localhost:3000)
 * EXPORT_WEB_URL          render from a running web app instead of apps/web/out
 *                         (or --web-url; `pnpm dev` uses the dev server on port 3000)
 * CHROME_PATH             Chrome or Chromium to use instead of the installed Google Chrome
 */
const port = Number(process.env.EXPORT_PORT ?? 8787);
const allowedOrigins = (process.env.EXPORT_ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const { values } = parseArgs({ options: { 'web-url': { type: 'string' } } });
const webUrl = values['web-url'] ?? process.env.EXPORT_WEB_URL;

const renderer = await createRenderer({ webUrl });
const service = createExportServer({ port, allowedOrigins, renderer });
await service.listen();
console.log(
  `Export service on http://127.0.0.1:${port} for ${allowedOrigins.join(', ')}, rendering ${webUrl ?? 'apps/web/out'}`,
);

const stop = async () => {
  await service.close();
  await renderer.close();
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
