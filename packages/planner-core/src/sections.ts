import type { SectionNode } from '@planner/schema';
import type { PhysicalPage } from './paginate';

/** A top-level section as printed: a contiguous run of pages (§8.3, per-section export). */
export interface SectionRange {
  /** Top-level section key, e.g. `month:2026-10`. */
  key: string;
  title: SectionNode['title'];
  /** 0-based page indices, inclusive. */
  from: number;
  to: number;
  /**
   * Starts on a right-hand page and has an even page count, so it fills whole sheets and can be
   * printed and filed on its own (ring binding, §8.4).
   */
  wholeSheets: boolean;
}

/**
 * Splits printed pages by top-level section. Filler pages outside any section (the back of the
 * previous sheet, end padding) belong to the section before them.
 */
export function sectionRanges(pages: readonly PhysicalPage[], root: SectionNode): SectionRange[] {
  const titles = new Map(root.children.flatMap((c) => ('title' in c ? [[c.key, c.title]] : [])));
  const ranges: SectionRange[] = [];
  for (const page of pages) {
    const key = page.sectionPath[1];
    const last = ranges.at(-1);
    if (last && (key === undefined || key === last.key)) {
      last.to = page.index;
    } else if (key !== undefined) {
      ranges.push({
        key,
        title: titles.get(key) ?? {},
        from: page.index,
        to: page.index,
        wholeSheets: false,
      });
    } else if (!last) {
      // Leading pages before any section: start an untitled range.
      ranges.push({
        key: root.key,
        title: root.title,
        from: page.index,
        to: page.index,
        wholeSheets: false,
      });
    }
  }
  for (const r of ranges) {
    r.wholeSheets = pages[r.from]?.side === 'right' && (r.to - r.from + 1) % 2 === 0;
  }
  return ranges;
}
