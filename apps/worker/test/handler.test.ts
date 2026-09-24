import type { RenderRequest } from '@planner/pdf/request';
import { createProject, parseTemplate } from '@planner/schema';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { describe, expect, it } from 'vitest';
import type { Env } from '../src/handler';
import { createHandler } from '../src/handler';

const template = parseTemplate(templateJson);
if (!template.ok) throw new Error('template invalid');
const project = createProject({
  id: 'p',
  name: 'Test',
  format: 'A4',
  locale: 'pl',
  now: '2026-09-24T00:00:00.000Z',
  template: template.value,
});

const ORIGIN = 'https://planner.example.workers.dev';
const rendered: { origin: string; request: RenderRequest }[] = [];
const handle = createHandler(async (_env, origin, request) => {
  rendered.push({ origin, request });
  return new TextEncoder().encode('%PDF-fake');
});

function env(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response('static file') } as unknown as Fetcher,
    BROWSER: {} as Fetcher,
    ...overrides,
  };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/export/pdf`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('worker', () => {
  it('leaves everything outside /api to static assets', async () => {
    const res = await handle(new Request(`${ORIGIN}/en/editor`), env());
    expect(await res.text()).toBe('static file');
    expect((await handle(new Request(`${ORIGIN}/api/nope`), env())).status).toBe(404);
  });

  it('reports whether PDF rendering is available', async () => {
    const health = (e: Env) => handle(new Request(`${ORIGIN}/api/export/health`), e);
    expect((await health(env())).status).toBe(200);
    expect((await health(env({ BROWSER: undefined }))).status).toBe(503);
  });

  it('renders a valid request from the same origin', async () => {
    const res = await handle(post({ project, from: 0, to: 3, padAfter: 0 }), env());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(rendered.at(-1)).toMatchObject({ origin: ORIGIN, request: { from: 0, to: 3 } });
  });

  it('refuses other sites, other methods and non-JSON', async () => {
    const body = { project, from: 0, to: 0, padAfter: 0 };
    expect((await handle(post(body, { origin: 'https://evil.example' }), env())).status).toBe(403);
    expect((await handle(new Request(`${ORIGIN}/api/export/pdf`), env())).status).toBe(405);
    expect((await handle(post(body, { 'content-type': 'text/plain' }), env())).status).toBe(415);
  });

  it('validates the planner and the page range', async () => {
    expect((await handle(post('{'), env())).status).toBe(400);
    expect((await handle(post({ project: {}, from: 0, to: 0, padAfter: 0 }), env())).status).toBe(
      422,
    );
    expect((await handle(post({ project, from: 3, to: 1, padAfter: 0 }), env())).status).toBe(422);
  });

  it('rate-limits per client and says when rendering is unavailable', async () => {
    const limited = env({
      EXPORT_LIMITER: { limit: async () => ({ success: false }) } as unknown as RateLimit,
    });
    const body = { project, from: 0, to: 0, padAfter: 0 };
    expect((await handle(post(body), limited)).status).toBe(429);
    expect((await handle(post(body), env({ BROWSER: undefined }))).status).toBe(503);
  });

  it('reports a failed render without the planner', async () => {
    const failing = createHandler(async () => {
      throw new Error('browser crashed');
    });
    const res = await failing(post({ project, from: 0, to: 0, padAfter: 0 }), env());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'render failed' });
  });
});
