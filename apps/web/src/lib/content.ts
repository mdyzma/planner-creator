import { effectiveModules } from '@planner/core';
import { DEFAULT_BINDINGS, redealContent } from '@planner/generator';
import type { ContentItem, ContentKind, ContentLibrary, PlannerProject } from '@planner/schema';

/** Where an item lives: its library and position. */
export interface LocatedItem {
  item: ContentItem;
  library: number;
  index: number;
}

/** Id prefixes per kind, e.g. q-0013 for quotes. */
export const ID_PREFIX: Record<ContentKind, string> = {
  quote: 'q-',
  affirmation: 'a-',
  prompt: 'p-',
  'sos-step': 's-',
  'warning-sign': 'w-',
  exercise: 'e-',
};

export function itemsOf(project: PlannerProject, kind: ContentKind): LocatedItem[] {
  return project.content.flatMap((lib, library) =>
    lib.items.flatMap((item, index) => (item.kind === kind ? [{ item, library, index }] : [])),
  );
}

const withLibraries = (project: PlannerProject, content: ContentLibrary[]): PlannerProject => ({
  ...project,
  content,
});

export function updateItem(
  project: PlannerProject,
  at: LocatedItem,
  item: ContentItem,
): PlannerProject {
  return withLibraries(
    project,
    project.content.map((lib, l) =>
      l === at.library
        ? { ...lib, items: lib.items.map((it, i) => (i === at.index ? item : it)) }
        : lib,
    ),
  );
}

export function deleteItem(project: PlannerProject, at: LocatedItem): PlannerProject {
  return withLibraries(
    project,
    project.content.map((lib, l) =>
      l === at.library ? { ...lib, items: lib.items.filter((_, i) => i !== at.index) } : lib,
    ),
  );
}

/** The library that holds a kind: the first one with such items, else a new one named after it. */
function libraryFor(
  project: PlannerProject,
  kind: ContentKind,
): { content: ContentLibrary[]; index: number } {
  const index = project.content.findIndex((lib) => lib.items.some((i) => i.kind === kind));
  if (index >= 0) return { content: project.content, index };
  const library = kind === 'quote' ? 'quotes' : `${kind}s`;
  const existing = project.content.findIndex((lib) => lib.library === library);
  if (existing >= 0) return { content: project.content, index: existing };
  return {
    content: [...project.content, { schemaVersion: 1, library, items: [] }],
    index: project.content.length,
  };
}

/** Adds items of one kind; items with an existing id replace it (re-importing a spreadsheet). */
export function upsertItems(
  project: PlannerProject,
  kind: ContentKind,
  items: readonly ContentItem[],
): PlannerProject {
  const { content, index } = libraryFor(project, kind);
  const byId = new Map(items.map((i) => [i.id, i]));
  const next = content.map((lib) => ({
    ...lib,
    items: lib.items.map((it) => byId.get(it.id) ?? it),
  }));
  const present = new Set(next.flatMap((lib) => lib.items.map((i) => i.id)));
  const added = items.filter((i) => !present.has(i.id));
  next[index] = { ...next[index]!, items: [...next[index]!.items, ...added] };
  return withLibraries(project, next);
}

/** Deals the current library onto the planner's pages again (after edits). */
export function redeal(project: PlannerProject) {
  const { root, report } = redealContent(project.document.root, {
    template: project.template,
    libraries: project.content,
    cadence: project.generation.quoteCadence,
    seed: project.id,
    bindings: DEFAULT_BINDINGS,
    modules: effectiveModules(project.template, project.generation),
  });
  return { project: { ...project, document: { root } }, report };
}

/** Offers a file to save, built in the browser; nothing leaves the device. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
