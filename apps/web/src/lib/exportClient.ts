import type { ExportPart, OutputFile } from '@planner/pdf';
import { assemble, mergePdfs, planExport } from '@planner/pdf';
import type { PlannerProject, PrintProfile } from '@planner/schema';
import { PAGE_FORMATS } from '@planner/schema';

/**
 * The PDF export service (§8.3). For now it runs on the user's own computer
 * (`pnpm --filter @planner/export-node serve`); the hosted service arrives in M8 and is selected
 * with NEXT_PUBLIC_EXPORT_URL.
 */
export const EXPORT_SERVICE_URL = (
  process.env.NEXT_PUBLIC_EXPORT_URL ?? 'http://127.0.0.1:8787'
).replace(/\/$/, '');

/** Parts rendered at the same time. */
const CONCURRENCY = 2;

export async function exportServiceAvailable(timeoutMs = 1500): Promise<boolean> {
  try {
    const res = await fetch(`${EXPORT_SERVICE_URL}/api/export/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class ExportError extends Error {
  constructor(
    readonly reason: 'offline' | 'rejected' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

async function renderPart(project: PlannerProject, part: ExportPart): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(`${EXPORT_SERVICE_URL}/api/export/pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, from: part.from, to: part.to, padAfter: part.padAfter }),
    });
  } catch (e) {
    throw new ExportError('offline', e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ExportError(res.status < 500 ? 'rejected' : 'failed', `${res.status} ${detail}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export interface ExportRequest {
  profile: PrintProfile;
  /** Print one top-level section only (e.g. a month for the ring binder). */
  section?: string;
  reverseBacks?: boolean;
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
  const plan = planExport(project, request);
  const results: Uint8Array[] = new Array(plan.parts.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < plan.parts.length) {
      const i = next++;
      results[i] = await renderPart(project, plan.parts[i]!);
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
