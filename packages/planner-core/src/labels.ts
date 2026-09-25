import type { PageNumbering, PageTemplate, SectionNode } from '@planner/schema';
import { isPageInstance } from '@planner/schema';
import type { PhysicalPage } from './paginate';

/** The number a page carries in print: "iii", "12", "S2" (§8.4, front matter in roman). */
export interface PageLabel {
  /** As printed and shown on screen; empty for unnumbered sections. */
  text: string;
  style: PageNumbering['style'];
  prefix: string;
  /** Position in its sequence, from 1. */
  value: number;
  /** Printed on the page: not a filler, not a hidden-number page (the cover), not unnumbered. */
  printed: boolean;
}

const ROMAN: [number, string][] = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

/** Lower-case roman numerals, as used for front matter: 4 → "iv". */
export function toRoman(n: number): string {
  let out = '';
  let rest = n;
  for (const [value, digits] of ROMAN) {
    while (rest >= value) {
      out += digits;
      rest -= value;
    }
  }
  return out;
}

const DEFAULT: PageNumbering = { style: 'arabic' };

/**
 * Printed page labels (book convention): each section can number its pages in arabic or roman
 * numerals, with a prefix, or not at all; a section without a setting follows its parent, and the
 * planner defaults to arabic. Every style + prefix is one sequence that continues across sections,
 * unless a section restarts it. Filler pages outside any section (the back of the previous sheet,
 * end padding) continue the sequence before them; they are counted but never printed.
 */
export function pageLabels(
  pages: readonly PhysicalPage[],
  root: SectionNode,
  templates: Readonly<Record<string, PageTemplate>> = {},
): PageLabel[] {
  const numberingOf = new Map<string, PageNumbering>();
  const walk = (node: SectionNode) => {
    if (node.numbering) numberingOf.set(node.key, node.numbering);
    for (const child of node.children) if (!isPageInstance(child)) walk(child);
  };
  walk(root);

  /** The innermost section that sets numbering, and its setting. */
  const governing = (path: readonly string[]) => {
    for (let i = path.length - 1; i >= 0; i--) {
      const numbering = numberingOf.get(path[i]!);
      if (numbering) return { key: path[i]!, numbering };
    }
    return undefined;
  };

  const counters = new Map<string, number>();
  const labels: PageLabel[] = [];
  let previous: { key: string; numbering: PageNumbering } | undefined;

  for (const page of pages) {
    const own = governing(page.sectionPath);
    // Fillers between sections belong to the section before them.
    const current = own ?? (page.filler && previous ? previous : { key: '', numbering: DEFAULT });
    const { style, prefix = '', restart } = current.numbering;
    const sequence = `${style}|${prefix}`;
    if (restart && current.key !== previous?.key) counters.set(sequence, 0);
    const value = (counters.get(sequence) ?? 0) + 1;
    counters.set(sequence, value);
    previous = current;

    const text =
      style === 'none' ? '' : `${prefix}${style === 'roman' ? toRoman(value) : String(value)}`;
    const template = page.instance ? templates[page.instance.templateId] : undefined;
    labels.push({
      text,
      style,
      prefix,
      value,
      printed: text !== '' && !page.filler && !template?.hidePageNumber,
    });
  }
  return labels;
}
