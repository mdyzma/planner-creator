import { PAGE_FORMATS, type FormatId } from './formats';
import type { GenerationConfig } from './generation';
import { PROJECT_MIGRATIONS, TEMPLATE_MIGRATIONS } from './migrations';
import type { Locale } from './primitives';
import type { PrintSettings, RingBinding } from './print';
import type { PlannerProject } from './project';
import type { PlannerTemplate } from './template';

/** ISO 838 two-hole punching: Ø 6 mm holes, centres 12 mm from the edge, 80 mm apart. */
export function iso838TwoHole(format: FormatId): RingBinding {
  const middle = PAGE_FORMATS[format].height / 2;
  return {
    kind: 'ring',
    preset: 'iso838-2hole',
    holeCentreFromEdge: 12,
    holeDiameter: 6,
    holePositions: [middle - 40, middle + 40],
    punchGuides: false,
  };
}

/** Home-printing, ring-bound defaults (§8.4, ADR-0006). */
export function defaultPrintSettings(format: FormatId): PrintSettings {
  return {
    profile: format === 'A5' ? 'home-a5-2up' : 'home-duplex',
    margins:
      format === 'A5'
        ? { inner: 18, outer: 11, top: 11, bottom: 13 }
        : { inner: 18, outer: 14, top: 14, bottom: 17 },
    printerSafeMargin: 5,
    outerRail: 0,
    bleed: 0,
    cropMarks: false,
    binding: iso838TwoHole(format),
    pageNumbers: true,
    brandMark: true,
    color: 'color',
    calibrationPage: false,
  };
}

export function defaultGenerationConfig(
  templateId: string,
  format: FormatId,
  locale: Locale,
): GenerationConfig {
  return {
    templateId,
    format,
    locale,
    durationMonths: 6,
    monthMode: 'calendar',
    weekOwnership: 'monday',
    dailyLayout: 'spread',
    weeklyLayout: 'spread',
    quoteCadence: 'daily',
    volumes: 1,
    variables: {},
  };
}

export const BLANK_TEMPLATE_ID = 'blank';

export function blankTemplate(): PlannerTemplate {
  return {
    schemaVersion: TEMPLATE_MIGRATIONS.current,
    id: BLANK_TEMPLATE_ID,
    version: '1.0.0',
    name: { en: 'Blank planner', pl: 'Pusty planer' },
    description: {
      en: 'An empty planner to build from scratch.',
      pl: 'Pusty planer do samodzielnego zbudowania.',
    },
    supportedFormats: ['A4', 'A5'],
    supportedLocales: ['en', 'pl'],
    defaults: { print: defaultPrintSettings('A4'), theme: {}, generation: {} },
    pageTemplates: {},
    sections: [],
    variables: [],
    contentLibraryRefs: [],
  };
}

export interface NewProjectInput {
  id: string;
  name: string;
  format: FormatId;
  locale: Locale;
  /** ISO timestamp; injected so callers and tests control time. */
  now: string;
  template?: PlannerTemplate;
}

export function createProject(input: NewProjectInput): PlannerProject {
  const template = input.template ?? blankTemplate();
  return {
    schemaVersion: PROJECT_MIGRATIONS.current,
    id: input.id,
    meta: { name: input.name, createdAt: input.now, updatedAt: input.now },
    templateSource: { id: template.id, version: template.version },
    template,
    content: [],
    generation: defaultGenerationConfig(template.id, input.format, input.locale),
    print: defaultPrintSettings(input.format),
    locale: input.locale,
    format: input.format,
    i18nOptions: { grammaticalGender: 'slash' },
    document: { root: { key: 'root', title: template.name, enabled: true, children: [] } },
  };
}
