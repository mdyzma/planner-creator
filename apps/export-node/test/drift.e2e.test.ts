import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from '@planner/generator';
import type { RenderRequest } from '@planner/pdf';
import { createProject, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { describe, expect, it } from 'vitest';
import { createRenderer } from '../src/render';

/**
 * Drift check (M8 exit criterion, drift.yml): the hosted Worker's Browser Run and a local Chrome
 * render the same pages of the deployed site, and the rasterised pages must match. Runs only when
 * DRIFT_URL (the deployed site) is set; needs `pdftoppm` (poppler-utils).
 */
const DRIFT_URL = process.env.DRIFT_URL?.replace(/\/$/, '');

/** Share of pixels allowed to differ noticeably (anti-aliasing, font hinting). */
const MAX_DIFFERENT_PIXELS = 0.01;
/** A pixel "differs" when its grey level is further apart than this (0–255). */
const PIXEL_TOLERANCE = 48;

function fixture(): RenderRequest {
  const template = parseTemplate(templateJson);
  const quotes = parseContentLibrary(quotesJson);
  if (!template.ok || !quotes.ok) throw new Error('fixtures invalid');
  const p = createProject({
    id: 'drift',
    name: 'Drift',
    format: 'A4',
    locale: 'pl',
    now: '2026-09-25T00:00:00.000Z',
    template: template.value,
  });
  const content = [quotes.value];
  const generation = { ...p.generation, startDate: '2026-10-01', durationMonths: 1 };
  const { document } = generate({
    template: p.template,
    config: generation,
    content,
    seed: 'drift',
  });
  // Cover, month opening, a week and a day: every kind of block.
  return { project: { ...p, content, generation, document }, from: 0, to: 11, padAfter: 0 };
}

/** Rasterises a PDF to 8-bit grey pages at 50 dpi with pdftoppm, returning raw pixels. */
function rasterise(pdf: Uint8Array, dir: string, name: string) {
  const file = join(dir, `${name}.pdf`);
  writeFileSync(file, pdf);
  const run = spawnSync('pdftoppm', ['-r', '50', '-gray', file, join(dir, name)]);
  if (run.status !== 0) throw new Error(`pdftoppm failed: ${run.stderr?.toString()}`);
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${name}-`) && f.endsWith('.pgm'))
    .sort()
    .map((f) => parsePgm(readFileSync(join(dir, f))));
}

/** Binary PGM (P5): header "P5 width height maxval" then one byte per pixel. */
function parsePgm(buf: Buffer) {
  const header = buf.subarray(0, 64).toString('latin1');
  const match = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(header);
  if (!match) throw new Error('not a PGM file');
  const [whole, w, h] = match;
  return { width: Number(w), height: Number(h), pixels: buf.subarray(whole.length) };
}

describe.skipIf(!DRIFT_URL)('drift: Browser Run matches local Chrome', () => {
  it('renders the same pages', async () => {
    const request = fixture();
    const remote = await fetch(`${DRIFT_URL}/api/export/pdf`, {
      method: 'POST',
      headers: { origin: DRIFT_URL!, 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(remote.status).toBe(200);
    const remotePdf = new Uint8Array(await remote.arrayBuffer());

    const renderer = await createRenderer({ webUrl: DRIFT_URL });
    let localPdf: Uint8Array;
    try {
      localPdf = await renderer.render(request);
    } finally {
      await renderer.close();
    }

    const dir = mkdtempSync(join(tmpdir(), 'drift-'));
    try {
      const a = rasterise(remotePdf, dir, 'remote');
      const b = rasterise(localPdf, dir, 'local');
      expect(a.length).toBe(request.to - request.from + 1);
      expect(b.length).toBe(a.length);
      a.forEach((page, i) => {
        const other = b[i]!;
        expect([page.width, page.height]).toEqual([other.width, other.height]);
        let different = 0;
        for (let p = 0; p < page.pixels.length; p++) {
          if (Math.abs(page.pixels[p]! - other.pixels[p]!) > PIXEL_TOLERANCE) different++;
        }
        const share = different / page.pixels.length;
        expect(share, `page ${i + 1}: ${(share * 100).toFixed(2)} % of pixels differ`).toBeLessThan(
          MAX_DIFFERENT_PIXELS,
        );
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
