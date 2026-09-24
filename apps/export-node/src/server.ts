import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MAX_IMPORT_BYTES, parseProject } from '@planner/schema';
import type { Renderer } from './render';

/**
 * Local export service (§8.3). The web app posts one part of a planner at a time and gets PDF
 * bytes back; it merges and imposes the parts itself. It listens on the loopback interface only,
 * keeps nothing, and answers only the origins in EXPORT_ALLOWED_ORIGINS.
 *
 *   GET  /api/export/health → { ok: true }
 *   POST /api/export/pdf    { project, from, to, padAfter } → application/pdf
 */

export interface ServerOptions {
  port?: number;
  allowedOrigins?: string[];
  renderer: Renderer;
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too-large'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const isInt = (v: unknown, min = 0): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min;

export function createExportServer({ port = 8787, allowedOrigins = [], renderer }: ServerOptions) {
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const server = createServer((req, res) => {
    void (async () => {
      const origin = req.headers.origin;
      if (origin) {
        if (!allowedOrigins.includes(origin))
          return json(res, 403, { error: 'origin not allowed' });
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'origin');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-methods': 'GET, POST',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '600',
          // Lets a hosted (HTTPS) copy of the app reach this loopback service in Chrome.
          ...(req.headers['access-control-request-private-network']
            ? { 'access-control-allow-private-network': 'true' }
            : {}),
        });
        return res.end();
      }
      const path = new URL(req.url ?? '/', 'http://x').pathname;
      if (req.method === 'GET' && path === '/api/export/health')
        return json(res, 200, { ok: true });
      if (req.method !== 'POST' || path !== '/api/export/pdf')
        return json(res, 404, { error: 'not found' });

      let body: unknown;
      try {
        body = JSON.parse(await readBody(req, MAX_IMPORT_BYTES + 1024));
      } catch (e) {
        const tooLarge = e instanceof Error && e.message === 'too-large';
        return json(res, tooLarge ? 413 : 400, { error: tooLarge ? 'too large' : 'invalid JSON' });
      }
      const { project, from, to, padAfter } = (body ?? {}) as Record<string, unknown>;
      const parsed = parseProject(project);
      if (!parsed.ok)
        return json(res, 422, { error: 'invalid project', issues: parsed.issues.slice(0, 5) });
      if (!isInt(from) || !isInt(to) || to < from || !isInt(padAfter) || padAfter > 3) {
        return json(res, 422, { error: 'invalid page range' });
      }
      try {
        const pdf = await renderer.render({ project: parsed.value, from, to, padAfter });
        res.writeHead(200, { 'content-type': 'application/pdf', 'cache-control': 'no-store' });
        res.end(Buffer.from(pdf));
      } catch (e) {
        // The project is never logged; only the failure.
        console.error('export failed:', e instanceof Error ? e.message : e);
        json(res, 500, { error: 'render failed' });
      }
    })();
  });

  return {
    listen: () => new Promise<void>((done) => server.listen(port, '127.0.0.1', () => done())),
    close: () => new Promise<void>((done) => server.close(() => done())),
    /** The bound port (useful with port 0 in tests). */
    port: () => (server.address() as AddressInfo).port,
  };
}
