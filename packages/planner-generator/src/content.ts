import type {
  BlockInstance,
  ContentItem,
  ContentKind,
  ContentLibrary,
  GenerationConfig,
  LayoutNode,
  PageInstance,
  PageTemplate,
  PlannerTemplate,
  SectionNode,
} from '@planner/schema';
import { isPageInstance } from '@planner/schema';

/** Which blocks receive which kind of library content (e.g. quote blocks get quotes). */
export interface ContentBinding {
  blockType: string;
  contentKind: ContentKind;
}

export const DEFAULT_BINDINGS: readonly ContentBinding[] = [
  { blockType: 'quote', contentKind: 'quote' },
];

export interface ContentReport {
  /** Blocks that received content. */
  slots: number;
  /** Library items available. */
  available: number;
  /** Most times any single item is used. */
  maxUses: number;
  /** Fewest slots between two uses of the same item; undefined when nothing repeats. */
  minGap?: number;
}

/** Items should not come back sooner than this many days (§4.5.1). */
export const NO_REPEAT_WITHIN = 30;

/** Deterministic 32-bit hash (FNV-1a) for seeding. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32): the same seed always gives the same order. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rng = random(hash(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function blockIdsOfType(page: PageTemplate, type: string): string[] {
  const walk = (n: LayoutNode): BlockInstance[] =>
    n.kind === 'block' ? [n.block] : n.children.flatMap(walk);
  return [...walk(page.body), ...(page.outerRail ?? []), ...(page.free ?? [])]
    .filter((b) => b.type === type)
    .map((b) => b.id);
}

/** Days since Monday 1970-01-05, so that whole weeks start on a Monday. */
const daysSinceEpochMonday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(1970, 0, 5)) / 86_400_000);
};

/** The undated week a page belongs to, from its key (`week:1.2/…`). */
const weekKeyOf = (pageKey: string) => /(?:^|\/)week:[^/]+/.exec(pageKey)?.[0];

/**
 * Deals library items onto the blocks that show them (§4.5.1): a seeded shuffle of the whole
 * library, indexed by date, so an item repeats only after every other item has been used and a
 * date always gets the same item. The result is stored in each page's `contentAssignments`, so
 * later edits never reshuffle it.
 */
export function assignContent(
  root: SectionNode,
  options: {
    template: PlannerTemplate;
    libraries: readonly ContentLibrary[];
    cadence: GenerationConfig['quoteCadence'];
    seed: string;
    bindings: readonly ContentBinding[];
    /** The planner's modules, on or off; items that need a module that is off are left out. */
    modules?: Readonly<Record<string, boolean>>;
  },
): { root: SectionNode; report: ContentReport } {
  const report: ContentReport = { slots: 0, available: 0, maxUses: 0 };
  if (options.cadence === 'none') return { root, report };

  const decks = new Map<ContentKind, ContentItem[]>();
  for (const binding of options.bindings) {
    const items = options.libraries
      .flatMap((lib) => lib.items)
      .filter(
        (i) =>
          i.kind === binding.contentKind &&
          (i.modules ?? []).every((m) => options.modules?.[m] !== false),
      );
    decks.set(binding.contentKind, seededShuffle(items, `${options.seed}:${binding.contentKind}`));
  }
  report.available = [...decks.values()].reduce((n, d) => n + d.length, 0);

  const uses = new Map<string, number[]>(); // item id → slot numbers where it was used
  let undatedPosition = 0;
  const undatedWeeks = new Map<string, number>();

  /**
   * Position in the deck for a page. Dated pages use the date itself (day number, or week number
   * for weekly cadence), so a date always gets the same item whatever the start date, consecutive
   * days never share one, and regenerating cannot create collisions. Undated pages count up.
   */
  const positionOf = (page: PageInstance): number => {
    const date = page.context.date;
    if (options.cadence === 'weekly') {
      if (date) return Math.floor(daysSinceEpochMonday(date) / 7);
      const week = weekKeyOf(page.key) ?? page.key;
      if (!undatedWeeks.has(week)) undatedWeeks.set(week, undatedWeeks.size);
      return undatedWeeks.get(week)!;
    }
    return date ? daysSinceEpochMonday(date) : undatedPosition++;
  };

  const pick = (kind: ContentKind, position: number): string | undefined => {
    const deck = decks.get(kind);
    if (!deck || deck.length === 0) return undefined;
    return deck[((position % deck.length) + deck.length) % deck.length]!.id;
  };

  const visit = (node: SectionNode): SectionNode => ({
    ...node,
    children: node.children.map((child) => {
      if (!isPageInstance(child)) return visit(child);
      const page = options.template.pageTemplates[child.templateId];
      if (!page) return child;
      const assignments: Record<string, string> = {};
      const blocks = options.bindings.flatMap((binding) =>
        blockIdsOfType(page, binding.blockType).map((blockId) => ({ binding, blockId })),
      );
      if (blocks.length === 0) return child;
      const position = positionOf(child);
      for (const [j, { binding, blockId }] of blocks.entries()) {
        // Several bound blocks on one page take consecutive items.
        const id = pick(binding.contentKind, position * blocks.length + j);
        if (!id) continue;
        assignments[blockId] = id;
        report.slots++;
        uses.set(id, [...(uses.get(id) ?? []), report.slots]);
      }
      return Object.keys(assignments).length > 0
        ? { ...child, contentAssignments: assignments }
        : child;
    }),
  });

  const result = visit(root);
  for (const slots of uses.values()) {
    report.maxUses = Math.max(report.maxUses, slots.length);
    for (let i = 1; i < slots.length; i++) {
      const gap = slots[i]! - slots[i - 1]!;
      report.minGap = report.minGap === undefined ? gap : Math.min(report.minGap, gap);
    }
  }
  return { root: result, report };
}

export interface ContentCoverage extends ContentReport {
  /** Pages whose assigned item no longer exists in the libraries (it was deleted). */
  missing: number;
}

/**
 * Measures the content actually on the planner's pages, in page order: how many blocks show an
 * item, how often items repeat, and how many point at deleted items.
 */
export function measureContent(
  root: SectionNode,
  libraries: readonly ContentLibrary[],
): ContentCoverage {
  const known = new Set(libraries.flatMap((l) => l.items.map((i) => i.id)));
  const coverage: ContentCoverage = { slots: 0, available: known.size, maxUses: 0, missing: 0 };
  const uses = new Map<string, number[]>();
  const visit = (node: SectionNode) => {
    for (const child of node.children) {
      if (!isPageInstance(child)) {
        visit(child);
        continue;
      }
      if (!child.enabled) continue;
      for (const id of Object.values(child.contentAssignments ?? {})) {
        coverage.slots++;
        if (!known.has(id)) coverage.missing++;
        uses.set(id, [...(uses.get(id) ?? []), coverage.slots]);
      }
    }
  };
  visit(root);
  for (const slots of uses.values()) {
    coverage.maxUses = Math.max(coverage.maxUses, slots.length);
    for (let i = 1; i < slots.length; i++) {
      const gap = slots[i]! - slots[i - 1]!;
      coverage.minGap = coverage.minGap === undefined ? gap : Math.min(coverage.minGap, gap);
    }
  }
  return coverage;
}

/** Removes every content assignment, so the library can be dealt again. */
function clearAssignments(node: SectionNode): SectionNode {
  return {
    ...node,
    children: node.children.map((child) => {
      if (!isPageInstance(child)) return clearAssignments(child);
      const { contentAssignments: _dropped, ...rest } = child;
      return rest;
    }),
  };
}

/**
 * Deals the current library onto the planner again after it was edited (M5), keeping pages,
 * their order and their edits. Uses the same date-based dealing as generation.
 */
export function redealContent(
  root: SectionNode,
  options: Parameters<typeof assignContent>[1],
): { root: SectionNode; report: ContentReport } {
  return assignContent(clearAssignments(root), options);
}
