import type {
  BlockInstance,
  FormatId,
  LayoutNode,
  Length,
  Locale,
  PageInstance,
  PageTemplate,
  PlannerProject,
  PlannerTemplate,
  SectionNode,
} from '@planner/schema';
import { blankTemplate, createProject } from '@planner/schema';

/**
 * Hand-written demo for M1 (print model): placeholder blocks in the real page structure, so
 * A4/A5, mirrored margins, spreads, rails and fillers can be checked before blocks (M3) and the
 * generator (M4) exist. Remove once the therapeutic template can be generated.
 */

const block = (id: string, type: string, height?: Length, width?: Length): LayoutNode => ({
  kind: 'block',
  block: { id, type, props: null, size: { height, width } },
});
const railBlock = (id: string, type: string): BlockInstance => ({ id, type, props: null });
const stack = (
  children: LayoutNode[],
  opts: { height?: Length; label?: { en: string; pl: string }; gap?: number } = {},
): LayoutNode => ({
  kind: 'stack',
  gap: opts.gap ?? 3,
  children,
  height: opts.height,
  label: opts.label,
});
const row = (children: LayoutNode[], height?: Length): LayoutNode => ({
  kind: 'row',
  gap: 4,
  children,
  height,
});

const dots = { kind: 'dots' as const, pitch: 5, ink: 0.45 };

const pageTemplates: Record<string, PageTemplate> = {
  cover: {
    id: 'cover',
    name: { en: 'Cover', pl: 'Okładka' },
    body: stack([block('title', 'heading', { mm: 40 }), block('subtitle', 'text', { mm: 20 })]),
  },
  'how-to': {
    id: 'how-to',
    name: { en: 'How to use', pl: 'Jak korzystać' },
    body: stack([block('heading', 'heading', { mm: 14 }), block('body', 'text', { fr: 1 })]),
  },
  'monthly-left': {
    id: 'monthly-left',
    name: { en: 'Month opening (left)', pl: 'Otwarcie miesiąca (lewa)' },
    spread: { group: 'monthly', position: 'left' },
    body: stack([
      block('month-name', 'heading', { mm: 16 }),
      block('calendar-mon-thu', 'calendar-grid', { mm: 110 }),
      block('goals', 'numbered-list', { fr: 1 }),
    ]),
  },
  'monthly-right': {
    id: 'monthly-right',
    name: { en: 'Month opening (right)', pl: 'Otwarcie miesiąca (prawa)' },
    spread: { group: 'monthly', position: 'right' },
    body: stack([
      block('focus', 'text', { mm: 16 }),
      block('calendar-fri-sun', 'calendar-grid', { mm: 110 }),
      block('dates', 'numbered-list', { fr: 1 }),
    ]),
  },
  'weekly-left': {
    id: 'weekly-left',
    name: { en: 'Week (left)', pl: 'Tydzień (lewa)' },
    spread: { group: 'weekly', position: 'left' },
    outerRailWidth: 30,
    outerRail: [railBlock('weekly-goals', 'numbered-list')],
    body: stack([
      block('focus', 'text', { mm: 24 }),
      block('mon', 'day-strip'),
      block('tue', 'day-strip'),
      block('wed', 'day-strip'),
    ]),
  },
  'weekly-right': {
    id: 'weekly-right',
    name: { en: 'Week (right)', pl: 'Tydzień (prawa)' },
    spread: { group: 'weekly', position: 'right' },
    outerRailWidth: 30,
    outerRail: [railBlock('weekly-wins', 'text')],
    body: stack([
      block('thu', 'day-strip'),
      block('fri', 'day-strip'),
      block('sat', 'day-strip'),
      block('sun', 'day-strip'),
    ]),
  },
  'daily-morning-day': {
    id: 'daily-morning-day',
    name: { en: 'Day: morning & day (left)', pl: 'Dzień: poranek i dzień (lewa)' },
    spread: { group: 'daily', position: 'left' },
    body: stack(
      [
        row(
          [
            block('date', 'date-sobriety', undefined, { fr: 2 }),
            block('quote', 'quote', undefined, { fr: 3 }),
          ],
          {
            mm: 18,
          },
        ),
        stack([block('pledge', 'text', { fr: 1 })], {
          height: { mm: 30 },
          label: { en: 'Morning', pl: 'Poranek' },
        }),
        stack(
          [
            row([
              block('priorities', 'numbered-list', undefined, { fr: 3 }),
              block('schedule', 'time-grid', undefined, { fr: 2 }),
            ]),
          ],
          { height: { fr: 1 }, label: { en: 'Day', pl: 'Dzień' } },
        ),
        stack([block('halt', 'rating-matrix', { fr: 1 })], {
          height: { mm: 38 },
          label: { en: 'HALT', pl: 'HALT' },
        }),
      ],
      { gap: 5 },
    ),
  },
  'daily-evening': {
    id: 'daily-evening',
    name: { en: 'Day: evening (right)', pl: 'Dzień: wieczór (prawa)' },
    spread: { group: 'daily', position: 'right' },
    background: dots,
    body: stack(
      [
        block('threat', 'reflection-question', { mm: 26 }),
        block('reflections', 'writing-area', { fr: 1 }),
        block('gratitude', 'numbered-list', { mm: 34 }),
      ],
      { gap: 5, label: { en: 'Evening', pl: 'Wieczór' } },
    ),
  },
  notes: {
    id: 'notes',
    name: { en: 'Notes (5 mm dots)', pl: 'Notatki (kropki 5 mm)' },
    background: dots,
    body: stack([]),
  },
};

const page = (key: string, templateId: string, date?: string): PageInstance => ({
  key,
  templateId,
  context: date ? { date } : {},
  enabled: true,
  origin: 'generated',
});

const days = ['2026-10-05', '2026-10-06', '2026-10-07'];

const root: SectionNode = {
  key: 'root',
  title: { en: 'Print model demo', pl: 'Demo modelu druku' },
  enabled: true,
  children: [
    {
      key: 'intro',
      title: { en: 'Introduction', pl: 'Wprowadzenie' },
      enabled: true,
      children: [page('intro/cover', 'cover'), page('intro/how-to', 'how-to')],
    },
    {
      key: 'm1',
      title: { en: 'October 2026', pl: 'Październik 2026' },
      enabled: true,
      sheetAligned: true,
      children: [
        page('m1/open/L', 'monthly-left'),
        page('m1/open/R', 'monthly-right'),
        {
          key: 'm1/w1',
          title: { en: 'Week 1', pl: 'Tydzień 1' },
          enabled: true,
          children: [
            page('m1/w1/L', 'weekly-left'),
            page('m1/w1/R', 'weekly-right'),
            ...days.flatMap((d) => [
              page(`m1/w1/d/${d}/L`, 'daily-morning-day', d),
              page(`m1/w1/d/${d}/R`, 'daily-evening', d),
            ]),
          ],
        },
        page('m1/notes', 'notes'),
      ],
    },
    {
      key: 'crisis',
      title: { en: 'Crisis plan', pl: 'Plan kryzysowy' },
      enabled: true,
      sheetAligned: true,
      children: [
        page('crisis/notes-1', 'notes'),
        page('crisis/notes-2', 'notes'),
        page('crisis/notes-3', 'notes'),
      ],
    },
  ],
};

export function createPrintModelDemo(input: {
  id: string;
  now: string;
  format: FormatId;
  locale: Locale;
}): PlannerProject {
  const template: PlannerTemplate = {
    ...blankTemplate(),
    id: 'print-model-demo',
    name: { en: 'Print model demo', pl: 'Demo modelu druku' },
    description: {
      en: 'Placeholder pages for checking page sizes, margins and spreads.',
      pl: 'Strony zastępcze do sprawdzenia rozmiarów, marginesów i rozkładówek.',
    },
    pageTemplates,
  };
  const project = createProject({ ...input, name: 'Print model demo', template });
  return { ...project, document: { root } };
}
