import {
  findBlock,
  insertBlock as insertIntoTemplate,
  moveBlock as moveInTemplate,
  removeBlock,
  uniqueBlockId,
  updateBlock,
} from '@planner/core';
import { regenerate } from '@planner/generator';
import type {
  BlockInstance,
  BlockPatch,
  Condition,
  JsonPatchOp,
  Length,
  PageInstance,
  PageRef,
  PageTemplate,
  PlannerProject,
  SectionNode,
  SectionTemplate,
} from '@planner/schema';
import { isPageInstance } from '@planner/schema';

/**
 * Document commands (§9.2). Every change the designer makes goes through one of these pure
 * functions, which gives undo/redo, autosave and dirty tracking a single choke point.
 */

/** Where an edit lands: every page using the template, or only one page (ADR-0003). */
export type EditScope = { kind: 'template' } | { kind: 'page'; pageKey: string };

export interface BlockRef {
  templateId: string;
  blockId: string;
}

type Json = BlockInstance['props'];
type Group = 'props' | 'style';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// ---------------------------------------------------------------------------------------------
// Helpers

function withTemplate(
  project: PlannerProject,
  templateId: string,
  fn: (t: PageTemplate) => PageTemplate,
): PlannerProject {
  const template = project.template.pageTemplates[templateId];
  if (!template) return project;
  const next = fn(template);
  if (next === template) return project;
  return {
    ...project,
    template: {
      ...project.template,
      pageTemplates: { ...project.template.pageTemplates, [templateId]: next },
    },
  };
}

function mapDocument(
  project: PlannerProject,
  onPage: (p: PageInstance) => PageInstance,
  onSection: (s: SectionNode) => SectionNode = (s) => s,
): PlannerProject {
  const visit = (node: SectionNode): SectionNode =>
    onSection({
      ...node,
      children: node.children.map((c) => (isPageInstance(c) ? onPage(c) : visit(c))),
    });
  return { ...project, document: { root: visit(project.document.root) } };
}

function withPage(
  project: PlannerProject,
  pageKey: string,
  fn: (p: PageInstance) => PageInstance,
): PlannerProject {
  return mapDocument(project, (p) => (p.key === pageKey ? fn(p) : p));
}

const blockOf = (project: PlannerProject, ref: BlockRef) => {
  const template = project.template.pageTemplates[ref.templateId];
  return template ? findBlock(template, ref.blockId) : undefined;
};

/** Locked blocks only accept being unlocked. */
export const isLocked = (project: PlannerProject, ref: BlockRef) =>
  blockOf(project, ref)?.block.locked === true;

/** Sets or (with `undefined`) removes a key of an object, dropping the object when it empties. */
function setKey<T extends Record<string, unknown>>(
  obj: T | undefined,
  key: string,
  value: unknown,
): T | undefined {
  const { [key]: _old, ...rest } = (obj ?? {}) as Record<string, unknown>;
  const next = value === undefined ? rest : { ...rest, [key]: value };
  return Object.keys(next).length > 0 ? (next as T) : undefined;
}

/** A page's patch for a block, with empty parts removed. */
function cleanPatch(patch: BlockPatch): BlockPatch | undefined {
  const next: BlockPatch = {};
  if (isRecord(patch.props) && Object.keys(patch.props).length > 0) next.props = patch.props;
  if (patch.style && Object.keys(patch.style).length > 0) next.style = patch.style;
  if (patch.hidden) next.hidden = true;
  return Object.keys(next).length > 0 ? next : undefined;
}

function withBlockPatch(
  project: PlannerProject,
  pageKey: string,
  blockId: string,
  fn: (patch: BlockPatch) => BlockPatch,
): PlannerProject {
  return withPage(project, pageKey, (page) => {
    const patch = cleanPatch(fn(page.overrides?.[blockId] ?? {}));
    const overrides = setKey(page.overrides, blockId, patch);
    const { overrides: _old, ...rest } = page;
    return overrides ? { ...rest, overrides } : rest;
  });
}

/**
 * The project format's adjustment for `subpath` of a block (e.g. `props/count` on A5), if any.
 * Editing such a value changes the adjustment, so the other format keeps its own value.
 */
function formatOpIndex(
  project: PlannerProject,
  template: PageTemplate,
  blockId: string,
  subpath: string,
): number {
  const entry = findBlock(template, blockId);
  const ops = template.formatOverrides?.[project.format];
  if (!entry || !ops) return -1;
  return ops.findIndex((op) => op.op !== 'remove' && op.path === `${entry.pointer}/${subpath}`);
}

function setFormatOp(
  project: PlannerProject,
  template: PageTemplate,
  index: number,
  value: unknown,
): PageTemplate {
  const ops = [...(template.formatOverrides?.[project.format] ?? [])];
  if (value === undefined) ops.splice(index, 1);
  else ops[index] = { ...ops[index]!, value: value as JsonPatchOp['value'] };
  return { ...template, formatOverrides: { ...template.formatOverrides, [project.format]: ops } };
}

// ---------------------------------------------------------------------------------------------
// Block values

/**
 * Sets a block property or style value; `undefined` resets it (to the template on a page, to the
 * block default on the template).
 */
export function setBlockValue(
  project: PlannerProject,
  ref: BlockRef,
  group: Group,
  key: string,
  value: unknown,
  scope: EditScope,
): PlannerProject {
  if (isLocked(project, ref)) return project;
  if (scope.kind === 'page') {
    return withBlockPatch(project, scope.pageKey, ref.blockId, (patch) => ({
      ...patch,
      [group]: setKey(patch[group] as Record<string, unknown> | undefined, key, value),
    }));
  }
  return withTemplate(project, ref.templateId, (template) => {
    const op = formatOpIndex(project, template, ref.blockId, `${group}/${key}`);
    if (op >= 0) return setFormatOp(project, template, op, value);
    return updateBlock(template, ref.blockId, (block) => {
      const current = group === 'props' ? (isRecord(block.props) ? block.props : {}) : block.style;
      const next = setKey(current as Record<string, unknown> | undefined, key, value);
      if (group === 'props') return { ...block, props: (next ?? {}) as Json };
      const { style: _old, ...rest } = block;
      return next ? { ...rest, style: next } : rest;
    });
  });
}

/** Height (in a stack) or width (in a row) of a block; `undefined` shares the free space. */
export function setBlockSize(
  project: PlannerProject,
  ref: BlockRef,
  axis: 'height' | 'width',
  value: Length | undefined,
): PlannerProject {
  if (isLocked(project, ref)) return project;
  return withTemplate(project, ref.templateId, (template) => {
    const op = formatOpIndex(project, template, ref.blockId, `size/${axis}`);
    if (op >= 0) return setFormatOp(project, template, op, value);
    return updateBlock(template, ref.blockId, (block) => {
      const size = setKey(block.size, axis, value);
      const { size: _old, ...rest } = block;
      return size ? { ...rest, size } : rest;
    });
  });
}

export function setBlockFlag(
  project: PlannerProject,
  ref: BlockRef,
  flag: 'locked' | 'keepTogether',
  value: boolean,
): PlannerProject {
  if (flag !== 'locked' && isLocked(project, ref)) return project;
  return withTemplate(project, ref.templateId, (template) =>
    updateBlock(template, ref.blockId, (block) => {
      const { [flag]: _old, ...rest } = block;
      return value ? { ...rest, [flag]: true } : rest;
    }),
  );
}

/** Only print the block on pages where the rule holds, e.g. only on right-hand pages. */
export function setBlockVisibility(
  project: PlannerProject,
  ref: BlockRef,
  visibility: Condition | undefined,
): PlannerProject {
  if (isLocked(project, ref)) return project;
  return withTemplate(project, ref.templateId, (template) =>
    updateBlock(template, ref.blockId, (block) => {
      const { visibility: _old, ...rest } = block;
      return visibility ? { ...rest, visibility } : rest;
    }),
  );
}

/** Hides or shows a block on one page only. */
export function setBlockHiddenOnPage(
  project: PlannerProject,
  pageKey: string,
  blockId: string,
  hidden: boolean,
): PlannerProject {
  return withBlockPatch(project, pageKey, blockId, (patch) => ({ ...patch, hidden }));
}

/** Drops a page's own changes to a block, so it follows the template again. */
export function resetBlockOnPage(
  project: PlannerProject,
  pageKey: string,
  blockId: string,
): PlannerProject {
  return withBlockPatch(project, pageKey, blockId, () => ({}));
}

// ---------------------------------------------------------------------------------------------
// Block structure (always the template: every page using it changes)

export interface NewBlock {
  type: string;
  props?: Record<string, unknown>;
  /** Suggested id; made unique within the template. */
  id?: string;
}

export function addBlock(
  project: PlannerProject,
  templateId: string,
  block: NewBlock,
  after?: string,
): { project: PlannerProject; blockId: string } {
  const template = project.template.pageTemplates[templateId];
  if (!template) return { project, blockId: '' };
  const blockId = uniqueBlockId(template, block.id ?? block.type);
  const instance: BlockInstance = {
    id: blockId,
    type: block.type,
    props: (block.props ?? {}) as Json,
  };
  return {
    project: withTemplate(project, templateId, (t) => insertIntoTemplate(t, instance, after)),
    blockId,
  };
}

export function duplicateBlock(
  project: PlannerProject,
  ref: BlockRef,
): { project: PlannerProject; blockId: string } {
  const template = project.template.pageTemplates[ref.templateId];
  const source = template && findBlock(template, ref.blockId)?.block;
  if (!template || !source) return { project, blockId: '' };
  const blockId = uniqueBlockId(template, source.id);
  const { locked: _locked, ...copy } = structuredClone(source);
  return {
    project: withTemplate(project, ref.templateId, (t) =>
      insertIntoTemplate(t, { ...copy, id: blockId }, ref.blockId),
    ),
    blockId,
  };
}

/** Deletes a block from the template, with every page's changes to it. */
export function deleteBlock(project: PlannerProject, ref: BlockRef): PlannerProject {
  if (isLocked(project, ref)) return project;
  const next = withTemplate(project, ref.templateId, (t) => removeBlock(t, ref.blockId));
  return mapDocument(next, (page) => {
    if (page.templateId !== ref.templateId || !page.overrides?.[ref.blockId]) return page;
    const overrides = setKey(page.overrides, ref.blockId, undefined);
    const { overrides: _old, ...rest } = page;
    return overrides ? { ...rest, overrides } : rest;
  });
}

/** Moves a block to position `to` among its siblings. */
export function moveBlock(project: PlannerProject, ref: BlockRef, to: number): PlannerProject {
  if (isLocked(project, ref)) return project;
  return withTemplate(project, ref.templateId, (t) => moveInTemplate(t, ref.blockId, to));
}

// ---------------------------------------------------------------------------------------------
// Pages and sections of this planner (kept by key when the planner is regenerated)

export function setPageEnabled(
  project: PlannerProject,
  pageKey: string,
  enabled: boolean,
): PlannerProject {
  return withPage(project, pageKey, (p) => ({ ...p, enabled }));
}

export function setSectionEnabled(
  project: PlannerProject,
  sectionKey: string,
  enabled: boolean,
): PlannerProject {
  return mapDocument(
    project,
    (p) => p,
    (s) => (s.key === sectionKey ? { ...s, enabled } : s),
  );
}

// ---------------------------------------------------------------------------------------------
// Structure recipe: the template's sections, from which every month is generated

/** Position of a section in the recipe: indices from the top level down (`[]` is the top). */
export type RecipePath = number[];

type RecipeChild = SectionTemplate | PageRef;

function editChildren(
  children: RecipeChild[],
  path: RecipePath,
  fn: (children: RecipeChild[]) => RecipeChild[],
): RecipeChild[] {
  if (path.length === 0) return fn(children);
  const [head, ...rest] = path;
  return children.map((child, i) =>
    i === head && !('page' in child)
      ? { ...child, children: editChildren(child.children, rest, fn) }
      : child,
  );
}

/** Changes the recipe, then regenerates the pages; edits stay on pages that still exist. */
function withRecipe(
  project: PlannerProject,
  path: RecipePath,
  fn: (children: RecipeChild[]) => RecipeChild[],
): PlannerProject {
  // Top-level entries are always sections.
  const sections = editChildren(project.template.sections, path, fn) as SectionTemplate[];
  return regenerate({ ...project, template: { ...project.template, sections } }).project;
}

/** Reorders a section's children (or the top-level sections) and regenerates. */
export function moveRecipeChild(
  project: PlannerProject,
  path: RecipePath,
  from: number,
  to: number,
): PlannerProject {
  return withRecipe(project, path, (children) => {
    if (from === to || !children[from] || to < 0 || to >= children.length) return children;
    const copy = [...children];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved!);
    return copy;
  });
}

/** Switches a recipe entry on or off (for every month) and regenerates. */
export function setRecipeChildEnabled(
  project: PlannerProject,
  path: RecipePath,
  index: number,
  enabled: boolean,
): PlannerProject {
  return withRecipe(project, path, (children) =>
    children.map((child, i) => {
      if (i !== index) return child;
      const { enabled: _old, ...rest } = child;
      return enabled ? rest : { ...rest, enabled: false };
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Variables

/** Sets a planner variable ({{patientName}} …); an empty value prints a line to write on. */
export function setVariable(
  project: PlannerProject,
  name: string,
  value: string,
  personal: boolean,
): PlannerProject {
  const { [name]: _old, ...rest } = project.generation.variables;
  const variables = value.trim() ? { ...rest, [name]: { value, personal } } : rest;
  return { ...project, generation: { ...project.generation, variables } };
}
