import { createProject, parseTemplate } from '@planner/schema';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RenderRequest } from '../src/render';
import { createExportServer } from '../src/server';

const template = parseTemplate(templateJson);
if (!template.ok) throw new Error('template invalid');
const project = createProject({
  id: 'p',
  name: 'Test',
  format: 'A4',
  locale: 'en',
  now: '2026-09-24T00:00:00.000Z',
  template: template.value,
});

const requests: RenderRequest[] = [];
const service = createExportServer({
  port: 0,
  allowedOrigins: ['http://localhost:3000'],
  renderer: {
    render: async (r) => {
      requests.push(r);
      return new TextEncoder().encode('%PDF-fake');
    },
    close: async () => {},
  },
});
let base = '';

beforeAll(async () => {
  await service.listen();
  base = `http://127.0.0.1:${service.port()}`;
});
afterAll(() => service.close());

const post = (body: unknown, origin = 'http://localhost:3000') =>
  fetch(`${base}/api/export/pdf`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });

describe('export service', () => {
  it('answers health checks and CORS preflight for allowed origins', async () => {
    expect(await (await fetch(`${base}/api/export/health`)).json()).toEqual({ ok: true });
    const pre = await fetch(`${base}/api/export/pdf`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('refuses other origins', async () => {
    expect(
      (await post({ project, from: 0, to: 0, padAfter: 0 }, 'https://evil.example')).status,
    ).toBe(403);
  });

  it('renders a valid request to PDF', async () => {
    const res = await post({ project, from: 0, to: 3, padAfter: 2 });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(await res.text()).toBe('%PDF-fake');
    expect(requests.at(-1)).toMatchObject({ from: 0, to: 3, padAfter: 2 });
  });

  it('rejects invalid projects, ranges and JSON', async () => {
    expect((await post({ project: { nope: 1 }, from: 0, to: 0, padAfter: 0 })).status).toBe(422);
    expect((await post({ project, from: 5, to: 1, padAfter: 0 })).status).toBe(422);
    expect((await post({ project, from: 0, to: 1, padAfter: 9 })).status).toBe(422);
    const bad = await fetch(`${base}/api/export/pdf`, { method: 'POST', body: '{' });
    expect(bad.status).toBe(400);
  });
});
