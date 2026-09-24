import type { ContentLibrary, Locale, PlannerProject, PlannerTemplate } from '@planner/schema';
import {
  MAX_IMPORT_BYTES,
  parseContentLibrary,
  parseProject,
  parseTemplate,
} from '@planner/schema';

/**
 * JSON import and export (§4, brief 28–29): a whole planner as a backup, or its template with
 * the content libraries it uses, for sharing and version control.
 */

export const TEMPLATE_BUNDLE_KIND = 'planner-template-bundle';

export interface TemplateBundle {
  kind: typeof TEMPLATE_BUNDLE_KIND;
  schemaVersion: 1;
  template: PlannerTemplate;
  content: ContentLibrary[];
}

/** A planner backup: everything, including the planner's own variable values. */
export const projectToJson = (project: PlannerProject): string =>
  `${JSON.stringify(project, null, 2)}\n`;

/**
 * The planner's template and content as a reusable file. Templates only define variables; the
 * values typed into this planner (names, dates) are not included.
 */
export function templateToJson(project: PlannerProject): string {
  const bundle: TemplateBundle = {
    kind: TEMPLATE_BUNDLE_KIND,
    schemaVersion: 1,
    template: project.template,
    content: project.content,
  };
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export type Imported =
  | { kind: 'project'; project: PlannerProject }
  | { kind: 'template'; template: PlannerTemplate; content: ContentLibrary[] }
  | { kind: 'error'; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const firstIssue = (issues: { path: string; message: string }[]) =>
  issues[0] ? `${issues[0].path || '(file)'}: ${issues[0].message}` : 'invalid';

/**
 * Reads a planner backup, a template bundle, or a bare template (like
 * templates/therapeutic-recovery/template.json). Everything is validated before use.
 */
export function readImport(text: string): Imported {
  if (text.length > MAX_IMPORT_BYTES) return { kind: 'error', message: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'error', message: 'not-json' };
  }
  if (!isRecord(raw)) return { kind: 'error', message: 'unknown' };

  if ('document' in raw && 'meta' in raw) {
    const parsed = parseProject(raw);
    return parsed.ok
      ? { kind: 'project', project: parsed.value }
      : { kind: 'error', message: firstIssue(parsed.issues) };
  }
  const templateRaw = raw.kind === TEMPLATE_BUNDLE_KIND ? raw.template : raw;
  if (isRecord(templateRaw) && 'pageTemplates' in templateRaw && 'sections' in templateRaw) {
    const template = parseTemplate(templateRaw);
    if (!template.ok) return { kind: 'error', message: firstIssue(template.issues) };
    const content: ContentLibrary[] = [];
    for (const lib of Array.isArray(raw.content) ? raw.content : []) {
      const parsed = parseContentLibrary(lib);
      if (!parsed.ok) return { kind: 'error', message: firstIssue(parsed.issues) };
      content.push(parsed.value);
    }
    return { kind: 'template', template: template.value, content };
  }
  return { kind: 'error', message: 'unknown' };
}

/** An imported planner gets a fresh id, so it never overwrites one already in this browser. */
export function asNewProject(project: PlannerProject, id: string, now: string): PlannerProject {
  const { lastExport: _dropped, ...meta } = project.meta;
  return { ...project, id, meta: { ...meta, createdAt: now, updatedAt: now } };
}

/** Picks the planner language for a new planner from an imported template. */
export const localeFor = (template: PlannerTemplate, preferred: Locale): Locale =>
  template.supportedLocales.includes(preferred) ? preferred : template.supportedLocales[0]!;
