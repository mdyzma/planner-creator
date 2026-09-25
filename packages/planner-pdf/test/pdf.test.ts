import fc from 'fast-check';
import { PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  PT_PER_MM,
  assemble,
  calibrationPdf,
  cutAndStack,
  manualDuplex,
  mergePdfs,
  toWinAnsi,
} from '../src';

describe('cut-and-stack imposition', () => {
  it('lays out 8 A5 pages on 2 sheets', () => {
    expect(cutAndStack(8)).toEqual([
      { front: { left: 1, right: 5 }, back: { left: 6, right: 2 } },
      { front: { left: 3, right: 7 }, back: { left: 8, right: 4 } },
    ]);
  });

  it('reads in order after one cut, with the right pile under the left pile', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 600 }), (n) => {
        const sheets = cutAndStack(n);
        // Turning a sheet over on its short edge puts the back's right half behind the front's
        // left half.
        const leftPile = sheets.flatMap((s) => [s.front.left, s.back.right]);
        const rightPile = sheets.flatMap((s) => [s.front.right, s.back.left]);
        const order = [...leftPile, ...rightPile].filter((p) => p !== null);
        expect(order).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(sheets).toHaveLength(Math.ceil(n / 4));
      }),
    );
  });
});

describe('manual duplex', () => {
  it('prints odd pages, then even pages in reverse', () => {
    expect(manualDuplex(5)).toEqual({ fronts: [1, 3, 5], backs: [null, 4, 2] });
    expect(manualDuplex(4, false)).toEqual({ fronts: [1, 3], backs: [2, 4] });
  });
});

async function pages(count: number, widthMm: number, heightMm: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    doc
      .addPage([widthMm * PT_PER_MM, heightMm * PT_PER_MM])
      .drawRectangle({ x: 10, y: 10, width: 5, height: 5 });
  }
  return doc.save();
}

const size = (doc: PDFDocument, i = 0) => {
  const { width, height } = doc.getPage(i).getSize();
  return [Math.round(width * 100) / 100, Math.round(height * 100) / 100];
};

const prefs = (doc: PDFDocument) => {
  const vp = doc.catalog.lookup(PDFName.of('ViewerPreferences'));
  return vp?.toString() ?? '';
};

describe('assemble', () => {
  const date = new Date('2026-09-24T00:00:00Z');

  it('merges parts in order and keeps A4 at 595.28 × 841.89 pt, 100 % and long-edge duplex', async () => {
    const merged = await mergePdfs([await pages(4, 210, 297), await pages(2, 210, 297)]);
    expect(merged.getPageCount()).toBe(6);
    const [file] = await assemble(merged, { profile: 'home-duplex', title: 'Planner', date });
    const out = await PDFDocument.load(file!.bytes);
    expect(out.getPageCount()).toBe(6);
    expect(size(out)).toEqual([595.28, 841.89]);
    expect(prefs(out)).toContain('/PrintScaling /None');
    expect(prefs(out)).toContain('/Duplex /DuplexFlipLongEdge');
    expect(out.getTitle()).toBe('Planner');
  });

  it('corrects the paper size Chrome rounds, keeping content anchored top-left', async () => {
    const chrome = await PDFDocument.create();
    chrome.addPage([594.96, 841.92]).drawRectangle({ x: 10, y: 10, width: 5, height: 5 });
    const merged = await mergePdfs([await chrome.save()], {
      pageSize: { width: 210, height: 297 },
    });
    expect(size(merged)).toEqual([595.28, 841.89]);
    const box = merged.getPage(0).getMediaBox();
    expect(Math.round((box.y + box.height) * 100) / 100).toBe(841.92);
  });

  it('puts two A5 pages on each A4 landscape sheet for 2-up, flipping on the short edge', async () => {
    const source = await PDFDocument.load(await pages(10, 148, 210));
    const [file] = await assemble(source, { profile: 'home-a5-2up', title: 'A5', date });
    const out = await PDFDocument.load(file!.bytes);
    // 10 pages → padded to 12 → 3 sheets, front and back.
    expect(out.getPageCount()).toBe(6);
    expect(size(out)).toEqual([841.89, 595.28]);
    expect(prefs(out)).toContain('/Duplex /DuplexFlipShortEdge');
  });

  it('splits manual duplex into a fronts file and a backs file', async () => {
    const source = await PDFDocument.load(await pages(5, 210, 297));
    const files = await assemble(source, { profile: 'home-manual-duplex', title: 'M', date });
    expect(files.map((f) => [f.suffix, f.pageCount])).toEqual([
      ['-1-fronts', 3],
      ['-2-backs', 3],
    ]);
  });

  it('lists pages by their printed labels: i, ii, then 1, 2, then S1', async () => {
    const source = await PDFDocument.load(await pages(6, 210, 297));
    const label = (text: string, style: 'roman' | 'arabic', prefix: string, value: number) => ({
      text,
      style,
      prefix,
      value,
      printed: true,
    });
    const [file] = await assemble(source, {
      profile: 'home-duplex',
      title: 'L',
      date,
      pageLabels: [
        label('i', 'roman', '', 1),
        label('ii', 'roman', '', 2),
        label('1', 'arabic', '', 1),
        label('2', 'arabic', '', 2),
        label('S1', 'arabic', 'S', 1),
        label('S2', 'arabic', 'S', 2),
      ],
    });
    const out = await PDFDocument.load(file!.bytes);
    const labels = out.catalog.lookup(PDFName.of('PageLabels'))?.toString() ?? '';
    expect(labels.replace(/\s+/g, ' ')).toMatch(
      /\/Nums \[ 0 <<.*\/S \/r.*>> 2 <<.*\/S \/D.*>> 4 <<.*\/P \(S\).*>> \]/s,
    );
  });

  it('marks trim and bleed boxes when there is bleed', async () => {
    const source = await PDFDocument.load(await pages(2, 216, 303));
    const [file] = await assemble(source, { profile: 'print-shop', title: 'B', bleedMm: 3, date });
    const out = await PDFDocument.load(file!.bytes);
    const trim = out.getPage(0).getTrimBox();
    expect(Math.round(trim.width * 100) / 100).toBe(595.28);
    expect(Math.round(trim.x * 100) / 100).toBe(8.5);
  });
});

describe('calibration sheet', () => {
  it('makes a two-sided sheet at the paper size, with Polish text made printable', async () => {
    const bytes = await calibrationPdf({
      width: 210,
      height: 297,
      labels: {
        title: 'Kalibracja',
        rulers: 'Każda linijka: 100 mm.',
        front: 'Przód',
        back: 'Tył',
      },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(size(doc)).toEqual([595.28, 841.89]);
    expect(toWinAnsi('Zażółć gęślą jaźń')).toBe('Zazólc gesla jazn');
  });
});
