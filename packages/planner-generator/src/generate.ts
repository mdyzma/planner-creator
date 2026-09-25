import { evaluateCondition, padToForProfile, paginate } from '@planner/core';
import { formatDate, localize } from '@planner/i18n';
import type {
  ContentLibrary,
  GenerationConfig,
  LocalizedText,
  PageContext,
  PageInstance,
  PlannerDocument,
  PlannerTemplate,
  PrintProfile,
  SectionNode,
  SectionTemplate,
} from '@planner/schema';
import { LOCALES } from '@planner/schema';
import type { MonthBlock, WeekBlock } from './calendar';
import { chunkDays, planMonths } from './calendar';
import type { ContentBinding, ContentReport } from './content';
import { DEFAULT_BINDINGS, assignContent } from './content';

export interface GenerateInput {
  template: PlannerTemplate;
  config: GenerationConfig;
  content: readonly ContentLibrary[];
  /** Makes content shuffling reproducible, e.g. the project id. */
  seed: string;
  /** Print profile, for the page budget's padding. */
  profile?: PrintProfile;
  bindings?: readonly ContentBinding[];
}

export interface PageBudget {
  /** Physical pages including filler pages. */
  total: number;
  fillers: number;
  sheets: number;
  byTemplate: Record<string, number>;
}

export interface GeneratorWarning {
  code: 'month-without-weeks' | 'unknown-page-template';
  detail: string;
}

export interface GenerateResult {
  document: PlannerDocument;
  budget: PageBudget;
  content: ContentReport;
  warnings: GeneratorWarning[];
}

interface Scope {
  month?: MonthBlock;
  week?: WeekBlock;
  days?: string[];
}

const byLocale = (fn: (locale: (typeof LOCALES)[number]) => string): LocalizedText =>
  Object.fromEntries(LOCALES.map((l) => [l, fn(l)])) as LocalizedText;

/** Page context from where the page sits: a day, a week or a month. */
function contextOf(scope: Scope): PageContext {
  const ctx: PageContext = {};
  if (scope.month) ctx.monthIndex = scope.month.index;
  if (scope.week) ctx.weekIndex = scope.week.index;
  if (scope.days && scope.days.length > 0) {
    ctx.date = scope.days[0];
    if (scope.days.length > 1) ctx.dates = scope.days;
  } else if (scope.week?.dates) {
    ctx.dates = scope.week.dates;
  } else if (scope.month?.date) {
    ctx.date = scope.month.date;
  }
  return ctx;
}

/**
 * Expands a template's sections into the editable page tree (§4.4, §12). Pure and deterministic:
 * the same template, config, content and seed always give the same document.
 */
export function generate(input: GenerateInput): GenerateResult {
  const { template, config } = input;
  const warnings: GeneratorWarning[] = [];
  const months = planMonths(config);
  for (const m of months) {
    if (m.weeks.length === 0) {
      warnings.push({ code: 'month-without-weeks', detail: localize(m.title, 'en') });
    }
  }

  const conditionScope = { config };

  const iterations = (
    section: SectionTemplate,
    scope: Scope,
  ): Array<{ key: string; global?: boolean; title: LocalizedText; scope: Scope }> => {
    const repeat = section.repeat;
    if (!repeat) return [{ key: section.id, title: section.title, scope }];
    // Months, weeks and days get global keys from their dates, so a page keeps its key when a new
    // start date moves its week into another month (ADR-0003).
    switch (repeat.over) {
      case 'months':
        return months.map((m) => ({
          key: m.key,
          global: true,
          title: m.title,
          scope: { ...scope, month: m },
        }));
      case 'weeksOfMonth':
        return (scope.month?.weeks ?? []).map((w) => ({
          key: w.key,
          global: true,
          title: w.title,
          scope: { ...scope, week: w },
        }));
      case 'daysOfWeek': {
        const week = scope.week;
        if (!week) return [];
        const group = repeat.group ?? 1;
        if (!week.dates) {
          // Undated planners get seven undated days per week.
          return Array.from({ length: Math.ceil(7 / group) }, (_, i) => ({
            key: `day:${week.key.slice('week:'.length)}.${i + 1}`,
            global: true,
            title: byLocale((l) => `${localize(section.title, l)} ${i + 1}`),
            scope: { ...scope, days: [] },
          }));
        }
        return chunkDays(week.days, group).map((chunk) => ({
          key: `day:${chunk[0]}`,
          global: true,
          title: byLocale((l) => chunk.map((d) => formatDate(d, l, 'full')).join(' – ')),
          scope: { ...scope, days: chunk },
        }));
      }
      case 'count':
        return Array.from({ length: repeat.n }, (_, i) => ({
          key: `${section.id}:${i + 1}`,
          title: byLocale((l) => `${localize(section.title, l)} ${i + 1}`),
          scope,
        }));
      case 'list':
        return repeat.items.map((item, i) => ({
          key: `${section.id}:${i + 1}`,
          title: byLocale(() => item),
          scope,
        }));
    }
  };

  const expand = (section: SectionTemplate, parentKey: string, scope: Scope): SectionNode[] => {
    if (section.enabled === false) return [];
    if (section.when && !evaluateCondition(section.when, conditionScope)) return [];
    return iterations(section, scope).map((it) => {
      const key = it.global ? it.key : `${parentKey}/${it.key}`;
      const seen = new Map<string, number>();
      const children: SectionNode['children'] = [];
      for (const child of section.children) {
        if ('page' in child) {
          if (!template.pageTemplates[child.page]) {
            warnings.push({ code: 'unknown-page-template', detail: child.page });
          }
          const n = (seen.get(child.page) ?? 0) + 1;
          seen.set(child.page, n);
          // Counted before skipping, so switching one page off keeps the other pages' keys.
          if (child.enabled === false) continue;
          const instance: PageInstance = {
            key: `${key}/${child.page}${n > 1 ? `#${n}` : ''}`,
            templateId: child.page,
            context: contextOf(it.scope),
            enabled: true,
            origin: 'generated',
          };
          children.push(instance);
        } else {
          children.push(...expand(child, key, it.scope));
        }
      }
      return {
        key,
        title: it.title,
        enabled: true,
        ...(section.startOn ? { startOn: section.startOn } : {}),
        ...(section.sheetAligned ? { sheetAligned: true } : {}),
        ...(section.numbering ? { numbering: section.numbering } : {}),
        children,
      };
    });
  };

  const root: SectionNode = {
    key: 'root',
    title: template.name,
    enabled: true,
    children: template.sections.flatMap((s) => expand(s, 'root', {})),
  };

  const { root: withContent, report } = assignContent(root, {
    template,
    libraries: input.content,
    cadence: config.quoteCadence,
    seed: input.seed,
    bindings: input.bindings ?? DEFAULT_BINDINGS,
  });

  const document: PlannerDocument = { root: withContent };
  return {
    document,
    budget: pageBudget(document, template, input.profile),
    content: report,
    warnings,
  };
}

/** Counts physical pages as they will print, including filler pages (§2, F1). */
export function pageBudget(
  document: PlannerDocument,
  template: PlannerTemplate,
  profile: PrintProfile = 'home-duplex',
): PageBudget {
  const { pages } = paginate(document.root, {
    templates: template.pageTemplates,
    padTo: padToForProfile(profile),
  });
  const byTemplate: Record<string, number> = {};
  let fillers = 0;
  for (const p of pages) {
    if (p.instance)
      byTemplate[p.instance.templateId] = (byTemplate[p.instance.templateId] ?? 0) + 1;
    else fillers++;
  }
  return { total: pages.length, fillers, sheets: Math.ceil(pages.length / 2), byTemplate };
}
