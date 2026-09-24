import type {
  BlockInstance,
  LayoutNode,
  Locale,
  LocalizedText,
  PlannerProject,
  SectionNode,
  SectionTemplate,
} from '@planner/schema';
import { LOCALES, isPageInstance } from '@planner/schema';
import { isLocalizedText, missingLocales } from './text';

/** Where a translatable text lives in a project, as a JSON path from the project root. */
export type TextPath = readonly (string | number)[];

export type TextKind =
  | 'template'
  | 'page-template'
  | 'layout-label'
  | 'block'
  | 'section'
  | 'variable'
  | 'content'
  | 'document-section';

export interface TranslationEntry {
  path: TextPath;
  kind: TextKind;
  /** The page template, content library item, section… this text belongs to. */
  ownerId: string;
  /** Which field of the owner, e.g. "name", "label", "props.title". */
  field: string;
  text: LocalizedText;
  missing: Locale[];
}

export interface TranslationReport {
  entries: TranslationEntry[];
  total: number;
  missingByLocale: Record<Locale, number>;
}

/**
 * Finds every translatable text in a project (§7): template metadata, page template names and
 * rationale, layout labels, texts inside block props, section and variable labels, and content
 * library items. Block props are opaque until the block registry (M3) declares its fields, so
 * they are scanned for LocalizedText-shaped objects.
 */
export function scanTranslations(
  project: PlannerProject,
  locales: readonly Locale[] = LOCALES,
): TranslationReport {
  const entries: TranslationEntry[] = [];
  const add = (
    path: TextPath,
    kind: TextKind,
    ownerId: string,
    field: string,
    text: LocalizedText | undefined,
  ) => {
    if (text)
      entries.push({ path, kind, ownerId, field, text, missing: missingLocales(text, locales) });
  };

  const t = project.template;
  add(['template', 'name'], 'template', t.id, 'name', t.name);
  add(['template', 'description'], 'template', t.id, 'description', t.description);

  const scanProps = (value: unknown, path: TextPath, ownerId: string, field: string) => {
    if (isLocalizedText(value)) {
      add(path, 'block', ownerId, field, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => scanProps(v, [...path, i], ownerId, `${field}[${i}]`));
    } else if (typeof value === 'object' && value !== null) {
      for (const [k, v] of Object.entries(value))
        scanProps(v, [...path, k], ownerId, `${field}.${k}`);
    }
  };
  const scanBlock = (block: BlockInstance, path: TextPath, pageId: string) =>
    scanProps(block.props, [...path, 'props'], `${pageId} › ${block.id}`, 'props');

  const scanLayout = (node: LayoutNode, path: TextPath, pageId: string) => {
    if (node.kind === 'block') {
      scanBlock(node.block, [...path, 'block'], pageId);
      return;
    }
    if (node.kind === 'stack') add([...path, 'label'], 'layout-label', pageId, 'label', node.label);
    node.children.forEach((child, i) => scanLayout(child, [...path, 'children', i], pageId));
  };

  for (const [id, page] of Object.entries(t.pageTemplates)) {
    const base = ['template', 'pageTemplates', id];
    add([...base, 'name'], 'page-template', id, 'name', page.name);
    add([...base, 'rationale'], 'page-template', id, 'rationale', page.rationale);
    scanLayout(page.body, [...base, 'body'], id);
    page.outerRail?.forEach((b, i) => scanBlock(b, [...base, 'outerRail', i], id));
    page.free?.forEach((b, i) => scanBlock(b, [...base, 'free', i], id));
  }

  const scanSectionTemplate = (s: SectionTemplate, path: TextPath) => {
    add([...path, 'title'], 'section', s.id, 'title', s.title);
    s.children.forEach((c, i) => {
      if ('children' in c) scanSectionTemplate(c, [...path, 'children', i]);
    });
  };
  t.sections.forEach((s, i) => scanSectionTemplate(s, ['template', 'sections', i]));

  t.variables.forEach((v, i) =>
    add(['template', 'variables', i, 'label'], 'variable', v.name, 'label', v.label),
  );

  project.content.forEach((library, li) =>
    library.items.forEach((item, ii) =>
      add(
        ['content', li, 'items', ii, 'text'],
        'content',
        `${library.library} › ${item.id}`,
        'text',
        item.text,
      ),
    ),
  );

  const scanDocument = (node: SectionNode, path: TextPath) => {
    if (node.key !== 'root')
      add([...path, 'title'], 'document-section', node.key, 'title', node.title);
    node.children.forEach((c, i) => {
      if (!isPageInstance(c)) scanDocument(c, [...path, 'children', i]);
    });
  };
  scanDocument(project.document.root, ['document', 'root']);

  const missingByLocale = Object.fromEntries(
    locales.map((l) => [l, entries.filter((e) => e.missing.includes(l)).length]),
  ) as Record<Locale, number>;
  return { entries, total: entries.length, missingByLocale };
}

/** Immutably replaces the value at `path`; used to write edited translations back. */
export function setAtPath<T>(root: T, path: TextPath, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setAtPath(copy[head as number], rest, value);
    return copy as T;
  }
  const obj = (root ?? {}) as Record<string, unknown>;
  return { ...obj, [head as string]: setAtPath(obj[head as string], rest, value) } as T;
}
