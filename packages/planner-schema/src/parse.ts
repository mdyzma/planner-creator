import type { z } from 'zod';
import { ContentLibrary } from './content';
import type { MigrationChain } from './migrations';
import {
  CONTENT_MIGRATIONS,
  PROJECT_MIGRATIONS,
  TEMPLATE_MIGRATIONS,
  runMigrations,
} from './migrations';
import { PlannerProject } from './project';
import { PlannerTemplate } from './template';

export interface ParseIssue {
  path: string;
  message: string;
}

export type ParseResult<T> =
  { ok: true; value: T; migratedFrom: number } | { ok: false; issues: ParseIssue[] };

/** Size limit for imported JSON (§10.3). */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

function migrateAndValidate<T>(
  raw: unknown,
  chain: MigrationChain,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const migrated = runMigrations(raw, chain);
  if (!migrated.ok) return { ok: false, issues: [{ path: '', message: migrated.error }] };
  const parsed = schema.safeParse(migrated.value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.map(String).join('.'),
        message: i.message,
      })),
    };
  }
  return { ok: true, value: parsed.data, migratedFrom: migrated.from };
}

export const parseProject = (raw: unknown) =>
  migrateAndValidate(raw, PROJECT_MIGRATIONS, PlannerProject);
export const parseTemplate = (raw: unknown) =>
  migrateAndValidate(raw, TEMPLATE_MIGRATIONS, PlannerTemplate);
export const parseContentLibrary = (raw: unknown) =>
  migrateAndValidate(raw, CONTENT_MIGRATIONS, ContentLibrary);

/** Parses JSON text from an import; rejects oversized input before parsing (§10.3). */
export function parseProjectJson(text: string) {
  if (text.length > MAX_IMPORT_BYTES) {
    return {
      ok: false as const,
      issues: [{ path: '', message: 'File is larger than 10 MB.' }],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false as const, issues: [{ path: '', message: 'Not valid JSON.' }] };
  }
  return parseProject(raw);
}
