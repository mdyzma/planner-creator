import type { ContentLibrary, PlannerProject, PlannerTemplate } from '@planner/schema';
import Dexie, { type EntityTable } from 'dexie';
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
  withExport,
  validateForWrite,
  validateStored,
} from './repository';

interface ProjectDocRow {
  id: string;
  doc: unknown;
}

interface VersionRow extends VersionSummary {
  doc: unknown;
}

interface ThumbnailRow {
  projectId: string;
  image: Blob;
}

/**
 * IndexedDB schema (§10.1). Personal data has no table: the product makes blank planners
 * (§10.2). Add one as a separate table if that ever changes.
 */
export class PlannerDatabase extends Dexie {
  projects!: EntityTable<ProjectSummary, 'id'>;
  projectDocs!: EntityTable<ProjectDocRow, 'id'>;
  versions!: Dexie.Table<VersionRow, [string, string]>;
  thumbnails!: EntityTable<ThumbnailRow, 'projectId'>;
  templates!: EntityTable<PlannerTemplate, 'id'>;
  contentLibraries!: EntityTable<ContentLibrary, 'library'>;

  constructor(name = 'planner-creator') {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt',
      projectDocs: 'id',
      versions: '[projectId+versionId], projectId, [projectId+createdAt]',
      thumbnails: 'projectId',
      templates: 'id',
      contentLibraries: 'library',
    });
  }
}

export class DexieProjectRepository implements ProjectRepository {
  constructor(
    private readonly db: PlannerDatabase,
    private readonly deps: RepositoryDeps = defaultDeps,
  ) {}

  async list(): Promise<ProjectSummary[]> {
    return this.db.projects.orderBy('updatedAt').reverse().toArray();
  }

  async get(id: string): Promise<PlannerProject | undefined> {
    const row = await this.db.projectDocs.get(id);
    return row && validateStored(row.doc, id);
  }

  async save(project: PlannerProject): Promise<PlannerProject> {
    const stamped = validateForWrite({
      ...project,
      meta: { ...project.meta, updatedAt: this.deps.now() },
    });
    await this.db.transaction('rw', this.db.projects, this.db.projectDocs, async () => {
      await this.db.projectDocs.put({ id: stamped.id, doc: stamped });
      await this.db.projects.put(summarize(stamped));
    });
    return stamped;
  }

  async recordExport(id: string, kind: 'pdf' | 'json', pageCount?: number): Promise<void> {
    const project = withExport(await this.require(id), this.deps.now(), kind, pageCount);
    await this.db.transaction('rw', this.db.projects, this.db.projectDocs, async () => {
      await this.db.projectDocs.put({ id, doc: project });
      await this.db.projects.put(summarize(project));
    });
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
    const { projects, projectDocs, versions, thumbnails } = this.db;
    await this.db.transaction('rw', [projects, projectDocs, versions, thumbnails], async () => {
      await projects.delete(id);
      await projectDocs.delete(id);
      await thumbnails.delete(id);
      await versions.where('projectId').equals(id).delete();
    });
  }

  async saveVersion(id: string, label?: string): Promise<VersionSummary> {
    const doc = await this.require(id);
    const createdAt = this.deps.now();
    const row: VersionRow = {
      projectId: id,
      versionId: this.deps.newId(),
      label: label ?? createdAt,
      createdAt,
      doc,
    };
    await this.db.transaction('rw', this.db.versions, async () => {
      await this.db.versions.put(row);
      const all = await this.versionRows(id);
      const excess = all.length - MAX_VERSIONS;
      if (excess > 0) {
        await this.db.versions.bulkDelete(
          all.slice(0, excess).map((v) => [v.projectId, v.versionId] as [string, string]),
        );
      }
    });
    return toSummary(row);
  }

  async listVersions(id: string): Promise<VersionSummary[]> {
    return (await this.versionRows(id)).reverse().map(toSummary);
  }

  async restoreVersion(id: string, versionId: string): Promise<PlannerProject> {
    const row = await this.db.versions.get([id, versionId]);
    if (!row) throw new StorageError(`Version ${versionId} of project ${id} not found.`);
    await this.saveVersion(id, 'Before restore');
    return this.save(validateStored(row.doc, id));
  }

  /** Oldest first, by creation time. */
  private versionRows(id: string): Promise<VersionRow[]> {
    return this.db.versions
      .where('[projectId+createdAt]')
      .between([id, Dexie.minKey], [id, Dexie.maxKey])
      .toArray();
  }

  private async require(id: string): Promise<PlannerProject> {
    const doc = await this.get(id);
    if (!doc) throw new StorageError(`Project ${id} not found.`);
    return doc;
  }
}

const toSummary = ({ doc: _doc, ...summary }: VersionRow): VersionSummary => summary;
