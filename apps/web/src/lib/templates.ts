import type {
  ContentLibrary,
  PageNumbering,
  PlannerProject,
  PlannerTemplate,
  SectionNode,
  SectionTemplate,
} from '@planner/schema';
import { blankTemplate, isPageInstance, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import therapeuticJson from '@planner/template-therapeutic-recovery/template.json';
import weeklyJson from '@planner/template-weekly-planner/template.json';

/** A template shipped with the app, with the content libraries it expects. */
export interface BundledTemplate {
  template: PlannerTemplate;
  content: ContentLibrary[];
}

function load(templateJson: unknown, content: unknown[]): BundledTemplate {
  const template = parseTemplate(templateJson);
  const libraries = content.map((c) => parseContentLibrary(c));
  if (!template.ok) throw new Error('A bundled template is invalid.');
  return {
    template: template.value,
    content: libraries.flatMap((l) => (l.ok ? [l.value] : [])),
  };
}

export const BUNDLED_TEMPLATES: BundledTemplate[] = [
  load(therapeuticJson, [quotesJson]),
  load(weeklyJson, []),
  { template: blankTemplate(), content: [] },
];

export const THERAPEUTIC_TEMPLATE_ID = BUNDLED_TEMPLATES[0]!.template.id;

/** First day of next month: the default start for a new dated planner. */
export function firstOfNextMonth(today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  return d.toISOString().slice(0, 10);
}

/** Rough spine thickness for home printing on 80–90 g/m² paper (≈ 0.11 mm per sheet). */
export const spineMm = (sheets: number) => Math.round(sheets * 0.11);

/**
 * The project with example handwriting and guide texts for every page template that has none,
 * taken from the bundled template of the same id. Planners created before examples existed keep
 * their own copy of the template, so this lets them print an example version too.
 */
export function withExampleContent(project: PlannerProject): PlannerProject {
  const bundled = BUNDLED_TEMPLATES.find((b) => b.template.id === project.template.id)?.template;
  if (!bundled) return project;
  const pageTemplates = Object.fromEntries(
    Object.entries(project.template.pageTemplates).map(([id, page]) => {
      const source = bundled.pageTemplates[id];
      return [
        id,
        {
          ...page,
          ...(!page.sampleContent && source?.sampleContent
            ? { sampleContent: source.sampleContent }
            : {}),
          ...(!page.sampleVariants && source?.sampleVariants
            ? { sampleVariants: source.sampleVariants }
            : {}),
          ...(!page.guideVariants && source?.guideVariants
            ? { guideVariants: source.guideVariants }
            : {}),
          ...(!page.guide && source?.guide ? { guide: source.guide } : {}),
        },
      ];
    }),
  );
  return { ...project, template: { ...project.template, pageTemplates } };
}

/** Template section id of a generated section: "root/intro" → intro, "month:2026-10" → month. */
const sectionIdOf = (key: string) => (key.split('/').at(-1) ?? key).split(':')[0] ?? key;

/**
 * The project with page numbering on every section and page that has none yet: from the
 * project's own template, else from the bundled template of the same id. Planners created before
 * numbering existed then print front matter in roman numerals and the crisis pages as S1, S2…
 * like new ones.
 */
export function withNumbering(project: PlannerProject): PlannerProject {
  const bundled = BUNDLED_TEMPLATES.find((b) => b.template.id === project.template.id)?.template;
  const numbering = new Map<string, PageNumbering>();
  const collect = (sections: readonly SectionTemplate[]) => {
    for (const s of sections) {
      if (s.numbering && !numbering.has(s.id)) numbering.set(s.id, s.numbering);
      collect(s.children.filter((c): c is SectionTemplate => !('page' in c)));
    }
  };
  collect(project.template.sections);
  if (bundled) collect(bundled.sections);
  if (numbering.size === 0) return project;

  const annotate = (node: SectionNode): SectionNode => {
    const found = node.numbering ?? numbering.get(sectionIdOf(node.key));
    return {
      ...node,
      ...(found ? { numbering: found } : {}),
      children: node.children.map((c) => (isPageInstance(c) ? c : annotate(c))),
    };
  };
  const pageTemplates = Object.fromEntries(
    Object.entries(project.template.pageTemplates).map(([id, page]) => [
      id,
      page.hidePageNumber === undefined && bundled?.pageTemplates[id]?.hidePageNumber
        ? { ...page, hidePageNumber: true }
        : page,
    ]),
  );
  return {
    ...project,
    template: { ...project.template, pageTemplates },
    document: { root: annotate(project.document.root) },
  };
}
