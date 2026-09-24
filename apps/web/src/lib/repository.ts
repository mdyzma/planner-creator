import type { ProjectRepository } from '@planner/storage';
import { DexieProjectRepository, PlannerDatabase } from '@planner/storage';

let repository: ProjectRepository | undefined;

/** Browser-only singleton. IndexedDB does not exist during the static build. */
export function getProjectRepository(): ProjectRepository {
  repository ??= new DexieProjectRepository(new PlannerDatabase());
  return repository;
}

/** Asks the browser not to evict our data under storage pressure (§10.1). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
