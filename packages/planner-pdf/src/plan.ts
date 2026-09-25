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
 * What to render for an export (§8.3): the whole planner, or any choice of top-level sections
 * (ring binding: a month at a time, without the introduction or crisis pages). One part per
 * section, rendered separately and merged in planner order; the end is padded once so the file
 * fills whole sheets for the print profile.
 */
export function planExport(
  project: PlannerProject,
  options: { profile: PrintProfile; sections?: readonly string[] },
): ExportPlan {
  const { pages } = paginate(project.document.root, {
    templates: project.template.pageTemplates,
    padTo: padToForProfile(project.print.profile),
  });
  const sections = sectionRanges(pages, project.document.root);

  const wanted = options.sections ? new Set(options.sections) : undefined;
  if (wanted) {
    for (const key of wanted) {
      if (!sections.some((s) => s.key === key)) {
        throw new Error(`No section “${key}” in this planner.`);
      }
    }
  }
  const chosen = wanted ? sections.filter((s) => wanted.has(s.key)) : sections;
  const parts: ExportPart[] = chosen.map((s) => ({
    key: s.key,
    from: s.from,
    to: s.to,
    padAfter: 0,
  }));
  const count = parts.reduce((n, p) => n + p.to - p.from + 1, 0);
  const padAfter = padFor(count, options.profile);
  if (parts.length > 0) parts[parts.length - 1]!.padAfter = padAfter;
  return { parts, pageCount: count + padAfter, sections };
}
