import type { FormatId, Locale, PlannerProject } from '@planner/schema';
import { countPageInstances, parseProject } from '@planner/schema';

/**
 * Persistence boundary (§10.1). The editor only talks to these interfaces, so a server-backed
 * implementation can replace IndexedDB later without touching UI code.
 */
export interface ProjectSummary {
  id: string;
  name: string;
  format: FormatId;
  locale: Locale;
  /** Logical page instances; physical pages (with fillers) come from pagination. */
  pageCount: number;
  createdAt: string;
  updatedAt: string;
  exportStatus: 'never' | 'exported' | 'stale';
}

export interface VersionSummary {
  projectId: string;
  versionId: string;
  label: string;
  createdAt: string;
}

export interface ProjectRepository {
  /** Newest first. */
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<PlannerProject | undefined>;
  /** Validates before writing; stamps `meta.updatedAt`. */
  save(project: PlannerProject): Promise<PlannerProject>;
  duplicate(id: string, name?: string): Promise<PlannerProject>;
  /** Removes the project and all its versions. */
  delete(id: string): Promise<void>;
  saveVersion(id: string, label?: string): Promise<VersionSummary>;
  /** Newest first. */
  listVersions(id: string): Promise<VersionSummary[]>;
  /** Snapshots the current state first, so a restore can itself be undone. */
  restoreVersion(id: string, versionId: string): Promise<PlannerProject>;
}

export interface RepositoryDeps {
  now: () => string;
  newId: () => string;
}

export const defaultDeps: RepositoryDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

/** Oldest versions beyond this count are pruned. */
export const MAX_VERSIONS = 50;

export class StorageError extends Error {
  constructor(
    message: string,
    readonly details: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function summarize(project: PlannerProject): ProjectSummary {
  const lastExport = project.meta.lastExport;
  return {
    id: project.id,
    name: project.meta.name,
    format: project.format,
    locale: project.locale,
    pageCount: countPageInstances(project.document.root),
    createdAt: project.meta.createdAt,
    updatedAt: project.meta.updatedAt,
    exportStatus: !lastExport
      ? 'never'
      : lastExport.at >= project.meta.updatedAt
        ? 'exported'
        : 'stale',
  };
}

/** Migrates and validates anything read from storage; corrupt data is reported, never half-loaded. */
export function validateStored(raw: unknown, id: string): PlannerProject {
  const result = parseProject(raw);
  if (!result.ok) throw new StorageError(`Stored project ${id} is invalid.`, result.issues);
  return result.value;
}

/** Validates before any write. */
export function validateForWrite(project: PlannerProject): PlannerProject {
  const result = parseProject(project);
  if (!result.ok) throw new StorageError('Refusing to save an invalid project.', result.issues);
  return result.value;
}
