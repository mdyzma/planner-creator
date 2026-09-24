import type { PlannerProject } from '@planner/schema';
import { createProject } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import type { ProjectRepository, RepositoryDeps } from '../src';
import { MAX_VERSIONS, StorageError } from '../src';

/** Deterministic clock and ids: every call moves time forward by one second. */
export function testDeps(): RepositoryDeps {
  let tick = 0;
  let id = 0;
  return {
    now: () => new Date(Date.UTC(2026, 8, 24, 10, 0, tick++)).toISOString(),
    newId: () => `id-${++id}`,
  };
}

const sample = (id: string, name = 'Planner'): PlannerProject =>
  createProject({ id, name, format: 'A4', locale: 'pl', now: '2026-01-01T00:00:00.000Z' });

/** Behaviour every ProjectRepository implementation must share. */
export function projectRepositoryContract(
  name: string,
  create: (deps: RepositoryDeps) => Promise<ProjectRepository>,
) {
  describe(`${name}: ProjectRepository contract`, () => {
    it('saves and reads back the same project, stamping updatedAt', async () => {
      const repo = await create(testDeps());
      const saved = await repo.save(sample('p1'));
      expect(saved.meta.updatedAt).toBe('2026-09-24T10:00:00.000Z');
      expect(await repo.get('p1')).toEqual(saved);
      expect(await repo.get('missing')).toBeUndefined();
    });

    it('lists summaries newest first', async () => {
      const repo = await create(testDeps());
      await repo.save(sample('a', 'First'));
      await repo.save(sample('b', 'Second'));
      const list = await repo.list();
      expect(list.map((s) => s.name)).toEqual(['Second', 'First']);
      expect(list[0]).toMatchObject({
        id: 'b',
        format: 'A4',
        locale: 'pl',
        pageCount: 0,
        exportStatus: 'never',
      });
    });

    it('reports export status against the last edit', async () => {
      const repo = await create(testDeps());
      const saved = await repo.save(sample('p'));
      await repo.save({
        ...saved,
        meta: { ...saved.meta, lastExport: { at: '2099-01-01T00:00:00.000Z', kind: 'pdf' } },
      });
      expect((await repo.list())[0]?.exportStatus).toBe('exported');
      const again = (await repo.get('p'))!;
      await repo.save({
        ...again,
        meta: { ...again.meta, lastExport: { at: '2000-01-01T00:00:00.000Z', kind: 'pdf' } },
      });
      expect((await repo.list())[0]?.exportStatus).toBe('stale');
    });

    it('refuses to save an invalid project', async () => {
      const repo = await create(testDeps());
      const broken = { ...sample('x'), format: 'A3' } as unknown as PlannerProject;
      await expect(repo.save(broken)).rejects.toBeInstanceOf(StorageError);
      expect(await repo.list()).toEqual([]);
    });

    it('duplicates with a new id and name, dropping export history', async () => {
      const repo = await create(testDeps());
      const original = await repo.save({
        ...sample('p', 'Mine'),
        meta: {
          ...sample('p', 'Mine').meta,
          lastExport: { at: '2026-01-02T00:00:00.000Z', kind: 'pdf' },
        },
      });
      const copy = await repo.duplicate(original.id);
      expect(copy.id).not.toBe(original.id);
      expect(copy.meta.name).toBe('Mine (copy)');
      expect(copy.meta.lastExport).toBeUndefined();
      expect(copy.document).toEqual(original.document);
      expect(await repo.list()).toHaveLength(2);
    });

    it('deletes a project together with its versions', async () => {
      const repo = await create(testDeps());
      await repo.save(sample('p'));
      await repo.saveVersion('p', 'v1');
      await repo.delete('p');
      expect(await repo.get('p')).toBeUndefined();
      expect(await repo.listVersions('p')).toEqual([]);
      expect(await repo.list()).toEqual([]);
    });

    it('saves, lists and restores versions; a restore can be undone', async () => {
      const repo = await create(testDeps());
      const v1Doc = await repo.save(sample('p', 'Before'));
      const v1 = await repo.saveVersion('p', 'first');
      await repo.save({ ...v1Doc, meta: { ...v1Doc.meta, name: 'After' } });

      const restored = await repo.restoreVersion('p', v1.versionId);
      expect(restored.meta.name).toBe('Before');

      const versions = await repo.listVersions('p');
      expect(versions.map((v) => v.label)).toEqual(['Before restore', 'first']);
      const undo = await repo.restoreVersion('p', versions[0]!.versionId);
      expect(undo.meta.name).toBe('After');
    });

    it(`keeps at most ${MAX_VERSIONS} versions, dropping the oldest`, async () => {
      const repo = await create(testDeps());
      await repo.save(sample('p'));
      for (let i = 0; i < MAX_VERSIONS + 3; i++) await repo.saveVersion('p', `v${i}`);
      const versions = await repo.listVersions('p');
      expect(versions).toHaveLength(MAX_VERSIONS);
      expect(versions[0]?.label).toBe(`v${MAX_VERSIONS + 2}`);
      expect(versions.at(-1)?.label).toBe('v3');
    });

    it('fails clearly for unknown projects and versions', async () => {
      const repo = await create(testDeps());
      await expect(repo.duplicate('nope')).rejects.toBeInstanceOf(StorageError);
      await expect(repo.saveVersion('nope')).rejects.toBeInstanceOf(StorageError);
      await repo.save(sample('p'));
      await expect(repo.restoreVersion('p', 'nope')).rejects.toBeInstanceOf(StorageError);
    });
  });
}
