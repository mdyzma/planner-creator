'use client';

import type { PlannerProject } from '@planner/schema';
import { useCallback, useEffect, useState } from 'react';
import { getProjectRepository } from './repository';

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; project: PlannerProject };

/** Loads a project from IndexedDB and saves changes back. */
export function useProject(id: string | null) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!id) {
      setState({ status: 'missing' });
      return;
    }
    let cancelled = false;
    getProjectRepository()
      .get(id)
      .then((project) => {
        if (!cancelled) setState(project ? { status: 'ready', project } : { status: 'missing' });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = useCallback(async (project: PlannerProject) => {
    setState({ status: 'ready', project });
    try {
      setState({ status: 'ready', project: await getProjectRepository().save(project) });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  return { state, save };
}
