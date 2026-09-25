import type { PageLabel } from '@planner/core';
import type { PrintProfile } from '@planner/schema';
import type { PDFPage } from 'pdf-lib';
import { Duplex, PDFDocument, PDFName, PDFString, PrintScaling, grayscale } from 'pdf-lib';
import { cutAndStack, manualDuplex } from './impose';

/** Points per millimetre (PDF user space is 1/72 inch). */
export const PT_PER_MM = 72 / 25.4;

/** A4 landscape sheet for 2-up printing, in points. */
const A4_LANDSCAPE = { width: 297 * PT_PER_MM, height: 210 * PT_PER_MM };

export interface OutputFile {
  /** File name suffix, e.g. `''` for the planner, `-fronts` / `-backs` for manual duplex. */
  suffix: string;
  bytes: Uint8Array;
  pageCount: number;
}

export interface AssembleOptions {
  profile: PrintProfile;
  title: string;
  /** Bleed around each page in mm; sets TrimBox/BleedBox when above zero. */
  bleedMm?: number;
  /** Manual duplex: print the backs in reverse order (most home printers). */
  reverseBacks?: boolean;
  /**
   * Printed label of each page (i, ii, 1, 2, S1…), written as the PDF's page labels so viewers
   * list pages by their printed numbers. Used for files in reading order only.
   */
  pageLabels?: readonly PageLabel[];
  /** Fixed dates keep output byte-stable in tests. */
  date?: Date;
}

/**
 * Writes PDF page labels (ISO 32000 §12.4.2): one range per run of pages sharing a style and
 * prefix with consecutive values.
 */
export function setPageLabels(doc: PDFDocument, labels: readonly PageLabel[]) {
  const nums: unknown[] = [];
  labels.forEach((label, i) => {
    const prev = labels[i - 1];
    const continues =
      prev &&
      prev.style === label.style &&
      prev.prefix === label.prefix &&
      (label.style === 'none' || prev.value + 1 === label.value);
    if (continues) return;
    const dict: Record<string, unknown> = {};
    if (label.style === 'roman') dict.S = PDFName.of('r');
    if (label.style === 'arabic') dict.S = PDFName.of('D');
    if (label.prefix) dict.P = PDFString.of(label.prefix);
    if (label.style !== 'none' && label.value !== 1) dict.St = label.value;
    nums.push(i, doc.context.obj(dict as never));
  });
  if (nums.length === 0) return;
  doc.catalog.set(PDFName.of('PageLabels'), doc.context.obj({ Nums: nums as never }));
}

/**
 * Sets a page's boxes to an exact size in mm. Chrome rounds the paper size to its own device
 * units (A4 comes out as 594.96 × 841.92 pt); the content is laid out in real mm from the top
 * left, so the box is anchored there and the page is exactly A4 (595.28 × 841.89 pt) again.
 */
export function setExactSize(page: PDFPage, widthMm: number, heightMm: number) {
  const w = widthMm * PT_PER_MM;
  const h = heightMm * PT_PER_MM;
  const box = page.getMediaBox();
  const top = box.y + box.height;
  page.setMediaBox(box.x, top - h, w, h);
  page.setCropBox(box.x, top - h, w, h);
}

/**
 * Joins rendered PDF parts (e.g. one per section) into one document, in order. With `pageSize`
 * (mm, trim + bleed), every page gets exactly that size.
 */
export async function mergePdfs(
  parts: readonly Uint8Array[],
  options: { pageSize?: { width: number; height: number } } = {},
): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  for (const bytes of parts) {
    const part = await PDFDocument.load(bytes);
    const pages = await out.copyPages(part, part.getPageIndices());
    for (const page of pages) {
      if (options.pageSize) setExactSize(page, options.pageSize.width, options.pageSize.height);
      out.addPage(page);
    }
  }
  return out;
}

function setBoxes(page: PDFPage, bleedMm: number) {
  const { width, height } = page.getSize();
  const b = bleedMm * PT_PER_MM;
  page.setBleedBox(0, 0, width, height);
  page.setTrimBox(b, b, width - 2 * b, height - 2 * b);
}

/**
 * Viewer hints every home export carries (§8.4): print at 100 %, and the duplex edge to flip on.
 * Acrobat honours them; other viewers partly, so the export dialog repeats the advice.
 */
function finalize(doc: PDFDocument, title: string, duplex: Duplex | null, date: Date) {
  const prefs = doc.catalog.getOrCreateViewerPreferences();
  prefs.setPrintScaling(PrintScaling.None);
  if (duplex) prefs.setDuplex(duplex);
  prefs.setDisplayDocTitle(true);
  doc.setTitle(title);
  doc.setProducer('Planner Designer');
  doc.setCreator('Planner Designer');
  doc.setCreationDate(date);
  doc.setModificationDate(date);
}

/** Copies the listed pages (1-based, `null` = blank page of the same size) into a new document. */
async function pick(source: PDFDocument, order: readonly (number | null)[]): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const first = source.getPage(0).getSize();
  for (const n of order) {
    if (n === null) {
      out.addPage([first.width, first.height]);
    } else {
      const [page] = await out.copyPages(source, [n - 1]);
      out.addPage(page!);
    }
  }
  return out;
}

/** Two A5 pages per A4 landscape sheet in cut-and-stack order, with a cut guide at the centre. */
async function twoUp(source: PDFDocument): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const count = source.getPageCount();
  const embedded = await out.embedPages(source.getPages());
  const { width: W, height: H } = A4_LANDSCAPE;
  const half = W / 2;

  const place = (sheet: PDFPage, n: number | null, x0: number) => {
    if (n === null) return;
    const page = embedded[n - 1]!;
    // Centre each page in its half; A5 (148 mm) is 0.5 mm narrower than half an A4 (148.5 mm).
    sheet.drawPage(page, {
      x: x0 + (half - page.width) / 2,
      y: (H - page.height) / 2,
      width: page.width,
      height: page.height,
    });
  };
  const cutGuide = (sheet: PDFPage) => {
    const len = 4 * PT_PER_MM;
    const style = { thickness: 0.4, color: grayscale(0.5) };
    sheet.drawLine({ start: { x: half, y: 0 }, end: { x: half, y: len }, ...style });
    sheet.drawLine({ start: { x: half, y: H }, end: { x: half, y: H - len }, ...style });
  };

  for (const { front, back } of cutAndStack(count)) {
    const f = out.addPage([W, H]);
    place(f, front.left, 0);
    place(f, front.right, half);
    cutGuide(f);
    const b = out.addPage([W, H]);
    place(b, back.left, 0);
    place(b, back.right, half);
    cutGuide(b);
  }
  return out;
}

/**
 * Turns the rendered pages (reading order) into the files to print for a print profile:
 * - `home-duplex`, `home-a5-native`, `print-shop`: one file in reading order, long-edge duplex;
 * - `home-manual-duplex`: a fronts file and a backs file;
 * - `home-a5-2up`: A4 landscape sheets, cut-and-stack, short-edge duplex.
 */
export async function assemble(
  source: PDFDocument,
  options: AssembleOptions,
): Promise<OutputFile[]> {
  const date = options.date ?? new Date();
  const bleed = options.bleedMm ?? 0;
  if (bleed > 0) for (const page of source.getPages()) setBoxes(page, bleed);

  const save = async (doc: PDFDocument, suffix: string, duplex: Duplex | null, title: string) => {
    finalize(doc, title, duplex, date);
    return { suffix, bytes: await doc.save(), pageCount: doc.getPageCount() };
  };

  const readingOrder = () => {
    if (options.pageLabels?.length === source.getPageCount()) {
      setPageLabels(source, options.pageLabels);
    }
    return source;
  };

  switch (options.profile) {
    case 'home-duplex':
    case 'home-a5-native':
    case 'print-shop':
      return [await save(readingOrder(), '', Duplex.DuplexFlipLongEdge, options.title)];
    case 'home-manual-duplex': {
      const { fronts, backs } = manualDuplex(source.getPageCount(), options.reverseBacks ?? true);
      return [
        await save(await pick(source, fronts), '-1-fronts', null, `${options.title} (1)`),
        await save(await pick(source, backs), '-2-backs', null, `${options.title} (2)`),
      ];
    }
    case 'home-a5-2up':
      return [await save(await twoUp(source), '', Duplex.DuplexFlipShortEdge, options.title)];
    case 'home-booklet':
      throw new Error('Booklet printing is not available yet.');
  }
}
