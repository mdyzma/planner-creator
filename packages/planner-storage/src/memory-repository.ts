import type { PlannerProject } from '@planner/schema';
import type {
  ProjectRepository,
  ProjectSummary,
  RepositoryDeps,
  VersionSummary,
} from './repository';
import {
  MAX_VERSIONS,
  StorageError,
  defaultDeps,
  summarize,
  validateForWrite,
  validateStored,
} from './repository';

interface StoredVersion extends VersionSummary {
  doc: PlannerProject;
}

/** In-memory implementation for tests and non-browser environments. */
export class MemoryProjectRepository implements ProjectRepository {
  private readonly docs = new Map<string, PlannerProject>();
  private readonly versions = new Map<string, StoredVersion[]>();

  constructor(private readonly deps: RepositoryDeps = defaultDeps) {}

  async list(): Promise<ProjectSummary[]> {
    return [...this.docs.values()]
      .map(summarize)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<PlannerProject | undefined> {
    const doc = this.docs.get(id);
    return doc && validateStored(structuredClone(doc), id);
  }

  async save(project: PlannerProject): Promise<PlannerProject> {
    const stamped = validateForWrite({
      ...project,
      meta: { ...project.meta, updatedAt: this.deps.now() },
    });
    this.docs.set(stamped.id, structuredClone(stamped));
    return stamped;
  }

  async duplicate(id: string, name?: string): Promise<PlannerProject> {
    const source = await this.require(id);
    const now = this.deps.now();
    const { lastExport: _dropped, ...meta } = source.meta;
    return this.save({
      ...source,
      id: this.deps.newId(),
      meta: { ...meta, name: name ?? `${source.meta.name} (copy)`, createdAt: now, updatedAt: now },
    });
  }

  async delete(id: string): Promise<void> {
    this.docs.delete(id);
    this.versions.delete(id);
  }

  async saveVersion(id: string, label?: string): Promise<VersionSummary> {
    const doc = await this.require(id);
    const createdAt = this.deps.now();
    const version: StoredVersion = {
      projectId: id,
      versionId: this.deps.newId(),
      label: label ?? createdAt,
      createdAt,
      doc,
    };
    const list = [...(this.versions.get(id) ?? []), version];
    this.versions.set(id, list.slice(-MAX_VERSIONS));
    return toSummary(version);
  }

  async listVersions(id: string): Promise<VersionSummary[]> {
    return [...(this.versions.get(id) ?? [])].reverse().map(toSummary);
  }

  async restoreVersion(id: string, versionId: string): Promise<PlannerProject> {
    const version = this.versions.get(id)?.find((v) => v.versionId === versionId);
    if (!version) throw new StorageError(`Version ${versionId} of project ${id} not found.`);
    await this.saveVersion(id, 'Before restore');
    return this.save(validateStored(structuredClone(version.doc), id));
  }

  private async require(id: string): Promise<PlannerProject> {
    const doc = await this.get(id);
    if (!doc) throw new StorageError(`Project ${id} not found.`);
    return doc;
  }
}

const toSummary = ({ doc: _doc, ...summary }: StoredVersion): VersionSummary => summary;
