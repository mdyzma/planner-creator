import type { GenerateResult } from '@planner/generator';
import { generate } from '@planner/generator';
import type { FormatId, Locale, PlannerProject } from '@planner/schema';
import { createProject } from '@planner/schema';
import type { BundledTemplate } from './templates';

export interface NewPlannerInput {
  bundle: BundledTemplate;
  id: string;
  name: string;
  format: FormatId;
  locale: Locale;
  now: string;
  /** Absent for an undated planner. */
  startDate?: string;
  durationMonths: number;
  /** Modules switched on or off (ADR-0010); the rest take the template's defaults. */
  modules?: Record<string, boolean>;
}

/** Creates a project from a bundled template and generates its pages (M4). */
export function createGeneratedProject(input: NewPlannerInput): {
  project: PlannerProject;
  result: GenerateResult;
} {
  const { bundle } = input;
  const base = createProject({ ...input, template: bundle.template });
  const project: PlannerProject = {
    ...base,
    content: bundle.content,
    generation: {
      ...base.generation,
      ...bundle.template.defaults.generation,
      templateId: bundle.template.id,
      format: input.format,
      locale: input.locale,
      startDate: input.startDate,
      durationMonths: input.durationMonths,
      ...(input.modules ? { modules: input.modules } : {}),
    },
  };
  const result = generate({
    template: project.template,
    config: project.generation,
    content: project.content,
    seed: project.id,
    profile: project.print.profile,
  });
  return { project: { ...project, document: result.document }, result };
}
