import { readFileSync } from 'node:fs';
import type {
  JsonPatchOp,
  LayoutNode,
  PageTemplate,
  PlannerTemplate,
  SectionTemplate,
} from '@planner/schema';
import { TEMPLATE_MIGRATIONS, defaultPrintSettings } from '@planner/schema';
import { L, block, fr, mmH, pointerToBlock, railBlock, stack } from './dsl';

/**
 * "Week by Week" ("Tydzień po Tygodniu"), a simple weekly planner: a month spread and a week
 * spread, nothing therapeutic. It is the second template, and uses the same engine and blocks as
 * "Day by Day" with no code of its own: sections repeat over months and weeks, pages are laid
 * out from blocks, and A4 and A5 come from the same page templates.
 */

type Text = ReturnType<typeof L>;

const heading = (id: string, text: Text, height = 12): LayoutNode =>
  block(id, 'text', { text, variant: 'heading' }, { height: mmH(height) });

/** A week day: the date and ruled lines, without the recovery planner's event markers. */
const day = (id: string, weekday: number): LayoutNode =>
  block(id, 'day-strip', { weekday, markers: [], lines: 4 }, { height: fr(1) });

const checklist = (id: string, title: Text, count: number): LayoutNode =>
  block(id, 'numbered-list', { title, count, marker: 'checkbox' }, { height: fr(1) });

/** A5 (148 × 210 mm) versions of block properties: fewer lines where the page is smaller. */
function a5(
  template: PageTemplate,
  changes: Array<[blockId: string, prop: string, value: unknown]>,
) {
  const ops: JsonPatchOp[] = changes.map(([id, prop, value]) => {
    const pointer = pointerToBlock(template.body, id);
    if (!pointer) throw new Error(`A5 override: no block "${id}" in ${template.id}`);
    return { op: 'add', path: `${pointer}/props/${prop}`, value: value as JsonPatchOp['value'] };
  });
  return { ...template, formatOverrides: { A5: ops } };
}

// ---------------------------------------------------------------------------------------------
// Introduction

/** The YAPCO line apple (docs/brand), embedded so that template.json stays self-contained. */
const APPLE = `data:image/svg+xml;base64,${readFileSync(
  new URL('../../../docs/brand/concepts/concept-2-line-apple.svg', import.meta.url),
).toString('base64')}`;

const cover: PageTemplate = {
  id: 'cover',
  name: L('Cover', 'Strona tytułowa'),
  hidePageNumber: true,
  body: stack(
    [
      block('top', 'spacer', {}, { height: fr(1) }),
      block(
        'apple',
        'image',
        { src: APPLE, alt: L('An apple with a tick', 'Jabłko z ptaszkiem') },
        { height: fr(2) },
      ),
      stack(
        [
          heading('title', L('Week by Week', 'Tydzień po Tygodniu'), 10),
          block(
            'subtitle',
            'text',
            {
              text: L('A planner for the weeks ahead', 'Planer na nadchodzące tygodnie'),
              variant: 'subheading',
            },
            { height: mmH(8) },
          ),
        ],
        { height: mmH(20), gap: 1 },
      ),
      block('gap', 'spacer', {}, { height: fr(1) }),
      block(
        'owner',
        'writing-area',
        { title: L('This planner belongs to', 'Ten planer należy do'), pattern: 'lines', pitch: 8 },
        { height: mmH(16) },
      ),
      stack(
        [
          block('start', 'text', {
            text: L('{{plannerStartDate}}', '{{plannerStartDate}}'),
            variant: 'subheading',
          }),
        ],
        { label: L('I start on', 'Zaczynam dnia'), height: mmH(16), gap: 1.5 },
      ),
      block('bottom', 'spacer', {}, { height: fr(1) }),
    ],
    { gap: 6 },
  ),
};

const year: PageTemplate = {
  id: 'year',
  name: L('My year', 'Mój rok'),
  body: stack([
    heading('heading', L('My year', 'Mój rok')),
    block(
      'goals',
      'numbered-list',
      { title: L('Goals for this year', 'Cele na ten rok'), count: 5, marker: 'checkbox' },
      { height: mmH(60) },
    ),
    block(
      'remember',
      'writing-area',
      {
        title: L('What I want to remember this year', 'O czym chcę pamiętać w tym roku'),
        pattern: 'lines',
        framed: true,
      },
      { height: mmH(40) },
    ),
    block(
      'notes',
      'writing-area',
      { title: L('Notes', 'Notatki'), pattern: 'dots', pitch: 5 },
      { height: fr(1) },
    ),
  ]),
};

// ---------------------------------------------------------------------------------------------
// Month

const monthLeft: PageTemplate = {
  id: 'month-left',
  name: L('Month (left)', 'Miesiąc (lewa)'),
  spread: { group: 'month', position: 'left' },
  body: stack([
    heading('month', L('{{monthName}}', '{{monthName}}')),
    block('calendar', 'calendar-grid', {}, { height: fr(3) }),
    block(
      'goals',
      'numbered-list',
      { title: L('Goals for this month', 'Cele na ten miesiąc'), count: 3, marker: 'checkbox' },
      { height: fr(1) },
    ),
  ]),
};

const monthRight = a5(
  {
    id: 'month-right',
    name: L('Month (right)', 'Miesiąc (prawa)'),
    spread: { group: 'month', position: 'right' },
    body: stack([
      block(
        'dates',
        'writing-area',
        { title: L('Important dates', 'Ważne daty'), pattern: 'lines', framed: true },
        { height: fr(1) },
      ),
      checklist('todo', L('To do this month', 'Do zrobienia w tym miesiącu'), 8),
      block(
        'notes',
        'writing-area',
        { title: L('Notes', 'Notatki'), pattern: 'lines' },
        { height: fr(1) },
      ),
    ]),
  },
  [['todo', 'count', 6]],
);

// ---------------------------------------------------------------------------------------------
// Week

const weekLeft: PageTemplate = {
  id: 'week-left',
  name: L('Week (left)', 'Tydzień (lewa)'),
  spread: { group: 'week', position: 'left' },
  rationale: L(
    'Monday to Wednesday, with the three priorities of the week in the outer column, where they stay in view.',
    'Poniedziałek–środa, a trzy priorytety tygodnia w zewnętrznej kolumnie, gdzie są zawsze na widoku.',
  ),
  outerRailWidth: 34,
  outerRail: [
    {
      ...railBlock(
        'priorities',
        'numbered-list',
        { title: L('This week', 'W tym tygodniu'), count: 3, marker: 'checkbox' },
        mmH(42),
      ),
      style: { borderWidthPt: 0.3, borderToken: 'line', radius: 1.5, padding: 2.5 },
    },
    railBlock(
      'remember',
      'writing-area',
      { title: L('Remember', 'Pamiętaj'), pattern: 'lines' },
      fr(1),
    ),
  ],
  body: stack([
    block(
      'range',
      'text',
      { text: L('Week {{weekRange}}', 'Tydzień {{weekRange}}'), variant: 'subheading' },
      { height: mmH(8) },
    ),
    day('mon', 0),
    day('tue', 1),
    day('wed', 2),
  ]),
};

const weekRight: PageTemplate = {
  id: 'week-right',
  name: L('Week (right)', 'Tydzień (prawa)'),
  spread: { group: 'week', position: 'right' },
  outerRailWidth: 34,
  outerRail: [
    railBlock(
      'todo',
      'numbered-list',
      { title: L('To do', 'Do zrobienia'), count: 8, marker: 'checkbox' },
      fr(1),
    ),
    railBlock('notes', 'writing-area', { title: L('Notes', 'Notatki'), pattern: 'lines' }, fr(1)),
  ],
  body: stack([day('thu', 3), day('fri', 4), day('sat', 5), day('sun', 6)]),
};

const notes: PageTemplate = {
  id: 'notes',
  name: L('Notes (5 mm dot grid)', 'Notatki (kropki 5 mm)'),
  body: stack([block('notes', 'writing-area', { pattern: 'dots', pitch: 5 }, { height: fr(1) })]),
};

// ---------------------------------------------------------------------------------------------
// Structure

const page = (id: string) => ({ page: id });

const sections: SectionTemplate[] = [
  {
    id: 'intro',
    title: L('Introduction', 'Wprowadzenie'),
    startOn: 'right',
    sheetAligned: true,
    numbering: { style: 'roman' },
    children: [page('cover'), page('year')],
  },
  {
    id: 'month',
    title: L('Month', 'Miesiąc'),
    repeat: { over: 'months' },
    // Every month starts on a new sheet, so months can be printed and filed one at a time.
    sheetAligned: true,
    children: [
      page('month-left'),
      page('month-right'),
      {
        id: 'week',
        title: L('Week', 'Tydzień'),
        repeat: { over: 'weeksOfMonth' },
        children: [page('week-left'), page('week-right')],
      },
      page('notes'),
    ],
  },
];

const pageTemplates = [cover, year, monthLeft, monthRight, weekLeft, weekRight, notes];

export const weeklyPlannerTemplate: PlannerTemplate = {
  schemaVersion: TEMPLATE_MIGRATIONS.current,
  id: 'weekly-planner',
  version: '1.0.0',
  name: L('Week by Week', 'Tydzień po Tygodniu'),
  description: L(
    'A simple weekly planner: a month spread with the calendar, goals and important dates, then a spread for each week with the days, three priorities and a to-do list.',
    'Prosty planer tygodniowy: rozkładówka miesiąca z kalendarzem, celami i ważnymi datami, potem rozkładówka każdego tygodnia z dniami, trzema priorytetami i listą zadań.',
  ),
  supportedFormats: ['A4', 'A5'],
  supportedLocales: ['en', 'pl'],
  defaults: {
    print: defaultPrintSettings('A4'),
    theme: {},
    generation: {
      durationMonths: 12,
      monthMode: 'calendar',
      weekOwnership: 'monday',
      dailyLayout: 'spread',
      weeklyLayout: 'spread',
      quoteCadence: 'none',
      volumes: 1,
    },
  },
  pageTemplates: Object.fromEntries(pageTemplates.map((p) => [p.id, p])),
  sections,
  variables: [],
  contentLibraryRefs: [],
};

/** Stable, reviewable JSON: two-space indent and a trailing newline. */
export const serializeTemplate = (template: PlannerTemplate): string =>
  `${JSON.stringify(template, null, 2)}\n`;
