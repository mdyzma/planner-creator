import type { RenderRequest } from '@planner/pdf/request';
import { parseRenderRequest } from '@planner/pdf/request';
import { MAX_IMPORT_BYTES } from '@planner/schema';

/**
 * The site's Worker (§8.3, §10.4). Static files are served by Workers Static Assets without
 * running this code; only `/api/*` reaches it (`run_worker_first` in wrangler.jsonc).
 *
 *   GET  /api/export/health → 200 { ok: true } when PDF rendering is available, else 503
 *   POST /api/export/pdf    { project, from, to, padAfter } → application/pdf
 *
 * The planner is rendered in memory and returned; it is never stored or logged.
 */

export interface Env {
  ASSETS: Fetcher;
  /** Browser Run binding; absent when the account has not enabled it. */
  BROWSER?: Fetcher;
  /** Workers rate limiting binding, per client IP. */
  EXPORT_LIMITER?: RateLimit;
}

/** Renders one request to PDF bytes, loading the print route from `origin`. */
export type RenderPdf = (env: Env, origin: string, request: RenderRequest) => Promise<Uint8Array>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export function createHandler(render: RenderPdf) {
  return async function handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/export/health') {
      return env.BROWSER ? json(200, { ok: true }) : json(503, { ok: false });
    }
    if (url.pathname !== '/api/export/pdf') {
      return url.pathname.startsWith('/api/')
        ? json(404, { error: 'not found' })
        : env.ASSETS.fetch(request);
    }
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' });

    // Only this site's own pages may ask for PDFs: browsers always send Origin on POST.
    if (request.headers.get('origin') !== url.origin) return json(403, { error: 'forbidden' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      return json(415, { error: 'expected JSON' });
    }
    if (!env.BROWSER) return json(503, { error: 'PDF rendering is not available' });

    if (env.EXPORT_LIMITER) {
      const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
      const { success } = await env.EXPORT_LIMITER.limit({ key });
      if (!success) return json(429, { error: 'too many requests' });
    }

    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > MAX_IMPORT_BYTES) return json(413, { error: 'too large' });
    const text = await request.text();
    if (text.length > MAX_IMPORT_BYTES) return json(413, { error: 'too large' });

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: 'invalid JSON' });
    }
    const parsed = parseRenderRequest(body);
    if (!parsed.ok) return json(422, { error: parsed.error, issues: parsed.issues });

    try {
      const pdf = await render(env, url.origin, parsed.request);
      return new Response(pdf, {
        headers: { 'content-type': 'application/pdf', 'cache-control': 'no-store' },
      });
    } catch (e) {
      // Only the failure is logged, never the planner.
      console.error('export failed:', e instanceof Error ? e.message : String(e));
      return json(502, { error: 'render failed' });
    }
  };
}
