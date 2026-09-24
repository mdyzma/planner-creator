import type { ContentLibrary, PlannerTemplate } from '@planner/schema';
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
