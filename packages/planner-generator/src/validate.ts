import type { PlannerTemplate, RepeatSpec, SectionTemplate } from '@planner/schema';

export interface TemplateIssue {
  severity: 'error' | 'warning';
  code:
    | 'unknown-page'
    | 'spread-incomplete'
    | 'spread-order'
    | 'repeat-outside-parent'
    | 'contradictory-alignment';
  where: string;
  message: string;
}

const REQUIRED_PARENT: Partial<Record<RepeatSpec['over'], RepeatSpec['over']>> = {
  weeksOfMonth: 'months',
  daysOfWeek: 'weeksOfMonth',
};

/**
 * Checks a template before generating from it (M4): missing pages, spreads without both halves or
 * split apart, repeats outside their parent (days need a week, weeks need a month), and alignment
 * rules that contradict each other and would force two blank pages in a row.
 */
export function validateTemplate(template: PlannerTemplate): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const pages = template.pageTemplates;

  const sides = new Map<string, Set<string>>();
  for (const page of Object.values(pages)) {
    if (!page.spread) continue;
    const set = sides.get(page.spread.group) ?? new Set<string>();
    set.add(page.spread.position);
    sides.set(page.spread.group, set);
  }
  for (const [group, set] of sides) {
    if (set.size < 2) {
      issues.push({
        severity: 'error',
        code: 'spread-incomplete',
        where: group,
        message: `Spread "${group}" has only a ${[...set][0]} page.`,
      });
    }
  }

  const walk = (section: SectionTemplate, path: string, repeats: RepeatSpec['over'][]) => {
    const where = `${path}/${section.id}`;
    const over = section.repeat?.over;
    const parent = over ? REQUIRED_PARENT[over] : undefined;
    if (parent && !repeats.includes(parent)) {
      issues.push({
        severity: 'error',
        code: 'repeat-outside-parent',
        where,
        message: `"${over}" must be inside a section that repeats over "${parent}".`,
      });
    }

    const first = section.children[0];
    if (
      first &&
      !('page' in first) &&
      first.sheetAligned &&
      section.startOn === 'left' &&
      !section.sheetAligned
    ) {
      issues.push({
        severity: 'warning',
        code: 'contradictory-alignment',
        where,
        message:
          'Starts on a left page but its first part starts on a new sheet (right page): two blank pages in a row.',
      });
    }

    section.children.forEach((child, i) => {
      if (!('page' in child)) {
        walk(child, where, over ? [...repeats, over] : repeats);
        return;
      }
      const page = pages[child.page];
      if (!page) {
        issues.push({
          severity: 'error',
          code: 'unknown-page',
          where,
          message: `Unknown page template "${child.page}".`,
        });
        return;
      }
      if (page.spread?.position === 'left') {
        const next = section.children[i + 1];
        const partner = next && 'page' in next ? pages[next.page] : undefined;
        if (
          !partner ||
          partner.spread?.group !== page.spread.group ||
          partner.spread.position !== 'right'
        ) {
          issues.push({
            severity: 'warning',
            code: 'spread-order',
            where,
            message: `"${child.page}" is the left half of spread "${page.spread.group}" but is not followed by its right half.`,
          });
        }
      }
    });
  };
  template.sections.forEach((s) => walk(s, '', []));
  return issues;
}
