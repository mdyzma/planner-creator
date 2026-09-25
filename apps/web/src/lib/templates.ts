import type { ContentLibrary, PlannerProject, PlannerTemplate } from '@planner/schema';
import { blankTemplate, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import therapeuticJson from '@planner/template-therapeutic-recovery/template.json';

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
          ...(!page.guide && source?.guide ? { guide: source.guide } : {}),
        },
      ];
    }),
  );
  return { ...project, template: { ...project.template, pageTemplates } };
}
