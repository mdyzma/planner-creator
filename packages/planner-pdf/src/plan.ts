import type { SectionRange } from '@planner/core';
import { padToForProfile, paginate, sectionRanges } from '@planner/core';
import type { PlannerProject, PrintProfile } from '@planner/schema';

/** One PDF part the renderer produces: printed pages `from`…`to` (0-based) plus blank pads. */
export interface ExportPart {
  key: string;
  from: number;
  to: number;
  padAfter: number;
}

export interface ExportPlan {
  parts: ExportPart[];
  /** Pages in the finished file(s), before imposition. */
  pageCount: number;
  /** Every top-level section, for choosing "print one month". */
  sections: SectionRange[];
}

/** Pages to add so `count` fills whole sheets for the profile (2, or 4 for 2-up). */
const padFor = (count: number, profile: PrintProfile) => {
  const unit = padToForProfile(profile);
  return (unit - (count % unit)) % unit;
};

/**
 * What to render for an export (§8.3): the whole planner as one part per top-level section, or
 * one section on its own (ring binding: print a month at a time). Parts are rendered separately,
 * a few at a time, and merged in order.
 */
export function planExport(
  project: PlannerProject,
  options: { profile: PrintProfile; section?: string },
): ExportPlan {
  const { pages } = paginate(project.document.root, {
    templates: project.template.pageTemplates,
    padTo: padToForProfile(project.print.profile),
  });
  const sections = sectionRanges(pages, project.document.root);

  if (options.section) {
    const range = sections.find((s) => s.key === options.section);
    if (!range) throw new Error(`No section “${options.section}” in this planner.`);
    const count = range.to - range.from + 1;
    const padAfter = padFor(count, options.profile);
    return {
      parts: [{ key: range.key, from: range.from, to: range.to, padAfter }],
      pageCount: count + padAfter,
      sections,
    };
  }

  const parts: ExportPart[] = sections.map((s) => ({
    key: s.key,
    from: s.from,
    to: s.to,
    padAfter: 0,
  }));
  const padAfter = padFor(pages.length, options.profile);
  if (parts.length > 0) parts[parts.length - 1]!.padAfter = padAfter;
  return { parts, pageCount: pages.length + padAfter, sections };
}
