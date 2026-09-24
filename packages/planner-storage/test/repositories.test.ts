import 'fake-indexeddb/auto';
import { createProject } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import {
  DexieProjectRepository,
  MemoryProjectRepository,
  PlannerDatabase,
  StorageError,
} from '../src';
import { projectRepositoryContract, testDeps } from './contract';

let dbCounter = 0;
const freshDb = () => new PlannerDatabase(`test-${++dbCounter}`);

projectRepositoryContract('memory', async (deps) => new MemoryProjectRepository(deps));
projectRepositoryContract('dexie', async (deps) => new DexieProjectRepository(freshDb(), deps));

describe('dexie: stored data', () => {
  it('migrates and validates on read, and reports corrupt rows', async () => {
    const db = freshDb();
    const repo = new DexieProjectRepository(db, testDeps());
    const project = createProject({
      id: 'p',
      name: 'P',
      format: 'A5',
      locale: 'en',
      now: '2026-01-01T00:00:00.000Z',
    });
    await repo.save(project);
    expect((await repo.get('p'))?.format).toBe('A5');

    await db.projectDocs.put({ id: 'p', doc: { ...project, schemaVersion: 99 } });
    await expect(repo.get('p')).rejects.toBeInstanceOf(StorageError);
  });

  it('persists across database instances with the same name', async () => {
    const name = `persist-${++dbCounter}`;
    const project = createProject({
      id: 'p',
      name: 'Kept',
      format: 'A4',
      locale: 'pl',
      now: '2026-01-01T00:00:00.000Z',
    });
    const first = new PlannerDatabase(name);
    await new DexieProjectRepository(first, testDeps()).save(project);
    first.close();

    const reopened = new DexieProjectRepository(new PlannerDatabase(name), testDeps());
    expect((await reopened.get('p'))?.meta.name).toBe('Kept');
  });
});
