import type { PDFPage } from 'pdf-lib';
import { Duplex, PDFDocument, PrintScaling, StandardFonts, grayscale } from 'pdf-lib';
import { PT_PER_MM } from './assemble';

export interface CalibrationLabels {
  title: string;
  /** Printed under the rulers, e.g. "Each ruler must measure exactly 100 mm." */
  rulers: string;
  /** Front side instructions. */
  front: string;
  /** Back side instructions. */
  back: string;
}

export interface CalibrationOptions {
  /** Sheet size in mm (the paper that goes through the printer). */
  width: number;
  height: number;
  labels: CalibrationLabels;
  date?: Date;
}

/**
 * The standard PDF fonts only cover Western European characters. The calibration sheet is a
 * utility page, so Polish letters outside that set are written without their accents rather
 * than embedding a font.
 */
export function toWinAnsi(text: string): string {
  const map: Record<string, string> = {
    ą: 'a',
    ć: 'c',
    ę: 'e',
    ł: 'l',
    ń: 'n',
    ś: 's',
    ź: 'z',
    ż: 'z',
    Ą: 'A',
    Ć: 'C',
    Ę: 'E',
    Ł: 'L',
    Ń: 'N',
    Ś: 'S',
    Ź: 'Z',
    Ż: 'Z',
    '„': '"',
    '”': '"',
    '–': '-',
    '—': '-',
    '→': '->',
    '×': 'x',
  };
  return [...text].map((c) => map[c] ?? c).join('');
}

const mm = (v: number) => v * PT_PER_MM;

/** A registration cross: coincides with the one on the other side when duplex is aligned. */
function cross(page: PDFPage, x: number, y: number) {
  const r = mm(5);
  const style = { thickness: 0.5, color: grayscale(0) };
  page.drawLine({ start: { x: mm(x) - r, y: mm(y) }, end: { x: mm(x) + r, y: mm(y) }, ...style });
  page.drawLine({ start: { x: mm(x), y: mm(y) - r }, end: { x: mm(x), y: mm(y) + r }, ...style });
  page.drawCircle({
    x: mm(x),
    y: mm(y),
    size: mm(2.5),
    borderWidth: 0.5,
    borderColor: grayscale(0),
  });
}

/**
 * A two-sided calibration sheet (§8.4): 100 mm rulers in both directions to check that nothing
 * scales the print, and registration crosses at the same places on both sides to check duplex
 * alignment (hold the sheet against the light).
 */
export async function calibrationPdf(options: CalibrationOptions): Promise<Uint8Array> {
  const { width, height, labels } = options;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Crosses 20 mm in from each corner and one in the middle, symmetric so they line up
  // whichever edge the printer flips on.
  const crosses: [number, number][] = [
    [20, 20],
    [width - 20, 20],
    [20, height - 20],
    [width - 20, height - 20],
    [width / 2, height / 2],
  ];
  const text = (page: PDFPage, s: string, x: number, y: number, size = 9, f = font) =>
    page.drawText(toWinAnsi(s), { x: mm(x), y: mm(y), size, font: f, color: grayscale(0) });
  const wrap = (s: string, max: number) => {
    const words = toWinAnsi(s).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, 9) > mm(max) && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  // Front
  const front = doc.addPage([mm(width), mm(height)]);
  text(front, labels.title, 30, height - 32, 14, bold);
  const left = 30;
  const top = height - 45;
  // Horizontal ruler: 100 mm with ticks every mm, longer every 5 and 10.
  const tick = { thickness: 0.3, color: grayscale(0) };
  front.drawLine({
    start: { x: mm(left), y: mm(top) },
    end: { x: mm(left + 100), y: mm(top) },
    ...tick,
  });
  for (let i = 0; i <= 100; i++) {
    const len = i % 10 === 0 ? 4 : i % 5 === 0 ? 3 : 1.5;
    front.drawLine({
      start: { x: mm(left + i), y: mm(top) },
      end: { x: mm(left + i), y: mm(top - len) },
      ...tick,
    });
    if (i % 10 === 0) text(front, String(i), left + i - 1, top - 8, 7);
  }
  // Vertical ruler below it.
  const vx = left;
  const vTop = top - 15;
  front.drawLine({
    start: { x: mm(vx), y: mm(vTop) },
    end: { x: mm(vx), y: mm(vTop - 100) },
    ...tick,
  });
  for (let i = 0; i <= 100; i++) {
    const len = i % 10 === 0 ? 4 : i % 5 === 0 ? 3 : 1.5;
    front.drawLine({
      start: { x: mm(vx), y: mm(vTop - i) },
      end: { x: mm(vx + len), y: mm(vTop - i) },
      ...tick,
    });
    if (i % 10 === 0 && i > 0) text(front, String(i), vx + 6, vTop - i - 1, 7);
  }
  wrap(labels.rulers, width - 70).forEach((l, i) => text(front, l, vx + 20, vTop - 20 - i * 5));
  wrap(labels.front, width - 70).forEach((l, i) => text(front, l, vx + 20, vTop - 50 - i * 5));
  for (const [x, y] of crosses) cross(front, x, y);

  // Back
  const back = doc.addPage([mm(width), mm(height)]);
  text(back, labels.title, 30, height - 32, 14, bold);
  wrap(labels.back, width - 60).forEach((l, i) => text(back, l, 30, height - 45 - i * 5));
  for (const [x, y] of crosses) cross(back, x, y);

  const prefs = doc.catalog.getOrCreateViewerPreferences();
  prefs.setPrintScaling(PrintScaling.None);
  prefs.setDuplex(Duplex.DuplexFlipLongEdge);
  doc.setTitle(toWinAnsi(labels.title));
  doc.setProducer('YAPCO');
  const date = options.date ?? new Date();
  doc.setCreationDate(date);
  doc.setModificationDate(date);
  return doc.save();
}
