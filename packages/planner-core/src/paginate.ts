import type { PageInstance, PageTemplate, SectionNode, Side } from '@planner/schema';
import { isPageInstance } from '@planner/schema';

/** One physical page of the printed planner, derived — never stored (ADR-0003). */
export interface PhysicalPage {
  /** 0-based position in the printed sequence. */
  index: number;
  /** 1-based printed page number. */
  number: number;
  /** Page 1 is a recto (right-hand page); sides alternate from there. */
  side: Side;
  /** Absent for filler pages. */
  instance?: PageInstance;
  /** Why a filler page exists. */
  filler?: 'align' | 'sheet-end' | 'pad';
  /** Keys of the enclosing sections, outermost first. */
  sectionPath: string[];
}

export interface PaginateOptions {
  templates: Readonly<Record<string, PageTemplate>>;
  /** Pad the total to a multiple of this: 2 for duplex sheets, 4 for 2-up A5 on A4. */
  padTo?: 1 | 2 | 4;
}

export interface PaginationWarning {
  code: 'unknown-template';
  pageKey: string;
  templateId: string;
}

export interface Pagination {
  pages: PhysicalPage[];
  warnings: PaginationWarning[];
}

export const sideOfIndex = (index: number): Side => (index % 2 === 0 ? 'right' : 'left');

function hasEnabledPages(section: SectionNode): boolean {
  if (!section.enabled) return false;
  return section.children.some((c) => (isPageInstance(c) ? c.enabled : hasEnabledPages(c)));
}

/**
 * Turns the edited document into the printed page sequence (§5.1).
 *
 * - Page 1 is a right-hand page; sides alternate.
 * - A page whose template belongs to a spread lands on its spread side; a filler page is
 *   inserted when needed so both halves of a spread face each other.
 * - A section with `startOn` starts on that side.
 * - A `sheetAligned` section starts on a recto and ends on a verso, so it occupies whole sheets
 *   and can be printed and filed on its own (ring binding, §8.4).
 * - The total is padded to a multiple of `padTo`.
 */
export function paginate(root: SectionNode, options: PaginateOptions): Pagination {
  const pages: PhysicalPage[] = [];
  const warnings: PaginationWarning[] = [];

  const push = (sectionPath: string[], extra: Partial<PhysicalPage>) => {
    const index = pages.length;
    pages.push({ index, number: index + 1, side: sideOfIndex(index), sectionPath, ...extra });
  };
  const ensureNextSide = (side: Side, sectionPath: string[]) => {
    if (sideOfIndex(pages.length) !== side) push(sectionPath, { filler: 'align' });
  };

  const walk = (section: SectionNode, parentPath: string[]) => {
    if (!hasEnabledPages(section)) return;
    const path = [...parentPath, section.key];
    const firstIndex = pages.length;

    // A filler that aligns a section's start belongs to the enclosing section: it is the back of
    // the previous sheet, not part of this section's sheets.
    if (section.sheetAligned) ensureNextSide('right', parentPath);
    else if (section.startOn === 'left' || section.startOn === 'right') {
      ensureNextSide(section.startOn, parentPath);
    }

    for (const child of section.children) {
      if (!isPageInstance(child)) {
        walk(child, path);
        continue;
      }
      if (!child.enabled) continue;
      const template = options.templates[child.templateId];
      if (!template) {
        warnings.push({
          code: 'unknown-template',
          pageKey: child.key,
          templateId: child.templateId,
        });
      } else if (template.spread) {
        ensureNextSide(template.spread.position, path);
      }
      push(path, { instance: child });
    }

    const last = pages.at(-1);
    if (section.sheetAligned && pages.length > firstIndex && last?.side === 'right') {
      push(path, { filler: 'sheet-end' });
    }
  };

  walk(root, []);

  const padTo = options.padTo ?? 1;
  while (pages.length % padTo !== 0) push([root.key], { filler: 'pad' });

  return { pages, warnings };
}

/**
 * Groups pages as they appear in the bound book: page 1 alone on the right, then
 * left/right pairs. The last spread may have only a left page.
 */
export function toSpreads(pages: readonly PhysicalPage[]): Array<{
  left?: PhysicalPage;
  right?: PhysicalPage;
}> {
  const spreads: Array<{ left?: PhysicalPage; right?: PhysicalPage }> = [];
  if (pages[0]) spreads.push({ right: pages[0] });
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push({ left: pages[i], right: pages[i + 1] });
  }
  return spreads;
}
