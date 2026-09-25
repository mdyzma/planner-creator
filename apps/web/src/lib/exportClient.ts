import type { ExportPart, OutputFile } from '@planner/pdf';
import { assemble, mergePdfs, planExport } from '@planner/pdf';
import type { PlannerProject, PrintProfile } from '@planner/schema';
import { PAGE_FORMATS } from '@planner/schema';
import { withExampleContent, withNumbering } from './templates';

/** The export service on the user's own computer (apps/export-node). */
export const LOCAL_EXPORT_SERVICE = 'http://127.0.0.1:8787';

/**
 * Where the PDF export service is (§8.3): NEXT_PUBLIC_EXPORT_URL when set; else the local
 * service during development (`pnpm dev`), and the site's own Worker (`/api/export`, Browser Run)
 * in the built site.
 */
export function exportServiceUrl(): string {
  const configured = process.env.NEXT_PUBLIC_EXPORT_URL;
  if (configured !== undefined) return configured.replace(/\/$/, '');
  return process.env.NODE_ENV === 'development' ? LOCAL_EXPORT_SERVICE : '';
}

/** True when PDFs come from the local service the user starts, not the hosted one. */
export const usesLocalExportService = () => exportServiceUrl() === LOCAL_EXPORT_SERVICE;

/** Parts rendered at the same time. */
const CONCURRENCY = 2;

export async function exportServiceAvailable(timeoutMs = 1500): Promise<boolean> {
  try {
    const res = await fetch(`${exportServiceUrl()}/api/export/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class ExportError extends Error {
  constructor(
    readonly reason: 'offline' | 'busy' | 'rejected' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

async function renderPart(
  project: PlannerProject,
  part: ExportPart,
  samples: boolean,
): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(`${exportServiceUrl()}/api/export/pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        from: part.from,
        to: part.to,
        padAfter: part.padAfter,
        ...(samples ? { samples: true } : {}),
      }),
    });
  } catch (e) {
    throw new ExportError('offline', e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const reason =
      res.status === 429 || res.status === 503 ? 'busy' : res.status < 500 ? 'rejected' : 'failed';
    throw new ExportError(reason, `${res.status} ${detail}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export interface ExportRequest {
  profile: PrintProfile;
  /** Top-level sections to print (e.g. single months for the ring binder); all when absent. */
  sections?: string[];
  reverseBacks?: boolean;
  /** An example planner: grey handwritten examples and explanatory notes on every page. */
  samples?: boolean;
}

/**
 * Renders the planner through the export service, a few parts at a time, then merges the parts
 * and imposes them for the print profile here in the browser.
 */
export async function exportPdf(
  project: PlannerProject,
  request: ExportRequest,
  onProgress?: (done: number, total: number) => void,
): Promise<OutputFile[]> {
  // Numbering and examples come from the bundled template where the planner has none (older
  // planners); the export service renders exactly this project.
  const source = withNumbering(request.samples ? withExampleContent(project) : project);
  const plan = planExport(source, request);
  const results: Uint8Array[] = new Array(plan.parts.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < plan.parts.length) {
      const i = next++;
      results[i] = await renderPart(source, plan.parts[i]!, request.samples === true);
      onProgress?.(++done, plan.parts.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.parts.length) }, worker));

  const { width, height } = PAGE_FORMATS[project.format];
  const bleed = project.print.bleed;
  const merged = await mergePdfs(results, {
    pageSize: { width: width + 2 * bleed, height: height + 2 * bleed },
  });
  return assemble(merged, {
    profile: request.profile,
    title: project.meta.name,
    bleedMm: bleed,
    reverseBacks: request.reverseBacks,
    pageLabels: plan.labels,
  });
}

/** A file name from the planner name, safe on every system: "6-miesieczny-planer". */
export function fileStem(name: string, section?: string): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[łŁ]/g, 'l')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  const stem = slug(name) || 'planner';
  return section ? `${stem}-${slug(section.replace(/^root\//, ''))}` : stem;
}

export function downloadBytes(filename: string, bytes: Uint8Array, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Give the download a moment to start before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
