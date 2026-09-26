import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Serves the web app's static export (`apps/web/out`) on a private loopback port, so Chrome can
 * load the print route exactly as it is deployed. `/en/print` resolves to `en/print.html`.
 */
export async function serveStatic(
  root: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const base = resolve(root);
  if (!(await isFile(join(base, 'index.html'))) && !(await isFile(join(base, 'en.html')))) {
    throw new Error(`No web build in ${base}. Run: pnpm --filter @planner/web build`);
  }
  const server = createServer((req, res) => {
    void (async () => {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      const target = normalize(join(base, path));
      if (target !== base && !target.startsWith(base + sep)) {
        res.writeHead(403).end();
        return;
      }
      const candidates = [target, `${target}.html`, join(target, 'index.html')];
      for (const file of candidates) {
        if (await isFile(file)) {
          res.writeHead(200, {
            'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          });
          createReadStream(file).pipe(res);
          return;
        }
      }
      res.writeHead(404).end();
    })();
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
