import fc from 'fast-check';
import type {
  BlockInstance,
  BlockStyle,
  Condition,
  ContentItem,
  ContentLibrary,
  GenerationConfig,
  LayoutNode,
  PageInstance,
  PageTemplate,
  PlannerProject,
  PlannerTemplate,
  PrintSettings,
  SectionNode,
  SectionTemplate,
} from '../src';
import { FORMAT_IDS, LOCALES } from '../src';

/** Arbitraries for *valid* documents, used by the round-trip properties. */

const optional = <T extends object>(
  model: { [K in keyof T]: fc.Arbitrary<T[K]> },
  requiredKeys: (keyof T)[],
) => fc.record(model, { requiredKeys: requiredKeys as never[] }) as fc.Arbitrary<T>;

export const id = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,15}$/);
export const text = fc.string({ unit: 'grapheme', maxLength: 30 });
export const mm = fc.integer({ min: 0, max: 5000 }).map((n) => n / 10);
export const isoDate = fc
  .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));
export const isoDateTime = fc
  .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true })
  .map((d) => d.toISOString());

export const localizedText = optional({ en: text, pl: text }, []);

const jsonKey = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/);
export const json: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constant(null),
    fc.boolean(),
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    text,
    fc.array(tie('value'), { maxLength: 3 }),
    fc.dictionary(jsonKey, tie('value'), { maxKeys: 3 }),
  ),
})).value;

const length = fc.oneof(
  mm.map((v) => ({ mm: v })),
  fc.integer({ min: 1, max: 10 }).map((fr) => ({ fr })),
  fc.constant('auto' as const),
);

const conditionValue = fc.oneof(text, fc.integer(), fc.boolean(), fc.constant(null));
const varRef = fc.stringMatching(/^[a-z][a-zA-Z.]{0,12}$/).map((v) => ({ var: v }));
const operand = fc.oneof(conditionValue, varRef);

export const condition: fc.Arbitrary<Condition> = fc.letrec((tie) => ({
  cond: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    varRef,
    fc.tuple(operand, operand).map((t) => ({ '==': t })),
    fc.tuple(operand, operand).map((t) => ({ '!=': t })),
    fc.tuple(operand, fc.array(conditionValue, { maxLength: 4 })).map((t) => ({ in: t })),
    fc.array(tie('cond'), { minLength: 1, maxLength: 3 }).map((c) => ({ and: c })),
    fc.array(tie('cond'), { minLength: 1, maxLength: 3 }).map((c) => ({ or: c })),
    tie('cond').map((c) => ({ not: c })),
  ),
})).cond as fc.Arbitrary<Condition>;

export const blockStyle: fc.Arbitrary<BlockStyle> = optional<BlockStyle>(
  {
    fontToken: text,
    fontSizePt: fc.integer({ min: 4, max: 96 }),
    fontWeight: fc.constantFrom(100, 400, 700, 900),
    lineHeight: fc.integer({ min: 8, max: 30 }).map((n) => n / 10),
    letterSpacingEm: fc.integer({ min: -2, max: 10 }).map((n) => n / 10),
    align: fc.constantFrom('start', 'center', 'end', 'justify'),
    colorToken: text,
    padding: mm,
    borderWidthPt: fc.integer({ min: 0, max: 10 }),
    borderToken: text,
    radius: mm,
  },
  [],
);

export const blockInstance: fc.Arbitrary<BlockInstance> = optional<BlockInstance>(
  {
    id,
    type: fc.constantFrom('text', 'rating-matrix', 'writing-area', 'numbered-list', 'time-grid'),
    props: json as fc.Arbitrary<BlockInstance['props']>,
    style: blockStyle,
    sideVariants: optional({ left: blockStyle, right: blockStyle }, []),
    size: optional({ width: length, height: length }, []),
    frame: fc.record({ x: mm, y: mm, w: mm, h: mm }),
    spreadSplit: fc.record({
      left: fc.tuple(fc.nat(6), fc.integer({ min: 1, max: 7 })),
      right: fc.tuple(fc.nat(6), fc.integer({ min: 1, max: 7 })),
    }),
    visibility: condition,
    locked: fc.boolean(),
    keepTogether: fc.boolean(),
  },
  ['id', 'type', 'props'],
);

export const layoutNode: fc.Arbitrary<LayoutNode> = fc.letrec((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    blockInstance.map((block) => ({ kind: 'block' as const, block })),
    optional(
      {
        kind: fc.constant('stack' as const),
        gap: mm,
        children: fc.array(tie('node'), { maxLength: 3 }),
        height: length,
        label: localizedText,
      },
      ['kind', 'gap', 'children'],
    ),
    optional(
      {
        kind: fc.constant('row' as const),
        gap: mm,
        children: fc.array(tie('node'), { maxLength: 3 }),
        height: length,
      },
      ['kind', 'gap', 'children'],
    ),
  ),
})).node as fc.Arbitrary<LayoutNode>;

export const pageTemplate: fc.Arbitrary<PageTemplate> = optional<PageTemplate>(
  {
    id,
    name: localizedText,
    spread: fc.record({ group: id, position: fc.constantFrom('left', 'right') }),
    background: optional(
      {
        kind: fc.constantFrom('blank', 'lines', 'dots', 'squares'),
        pitch: mm,
        ink: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
      },
      ['kind'],
    ),
    body: layoutNode,
    outerRail: fc.array(blockInstance, { maxLength: 2 }),
    outerRailWidth: mm,
    free: fc.array(blockInstance, { maxLength: 2 }),
    formatOverrides: optional(
      {
        A4: fc.array(
          optional(
            {
              op: fc.constantFrom('add', 'remove', 'replace'),
              path: fc.constantFrom('/body/gap', '/background'),
              value: json,
            },
            ['op', 'path'],
          ),
          { maxLength: 2 },
        ),
      },
      [],
    ) as fc.Arbitrary<PageTemplate['formatOverrides']>,
    rationale: localizedText,
    sampleContent: fc.dictionary(id, json, { maxKeys: 2 }) as fc.Arbitrary<
      PageTemplate['sampleContent']
    >,
  },
  ['id', 'name', 'body'],
);

const startOn = fc.constantFrom('left', 'right', 'any') as fc.Arbitrary<'left' | 'right' | 'any'>;
const repeat = fc.oneof(
  fc.constant({ over: 'months' as const }),
  fc.constant({ over: 'weeksOfMonth' as const }),
  optional({ over: fc.constant('daysOfWeek' as const), group: fc.integer({ min: 1, max: 7 }) }, [
    'over',
  ]),
  fc.integer({ min: 1, max: 20 }).map((n) => ({ over: 'count' as const, n })),
  fc.array(text, { maxLength: 3 }).map((items) => ({ over: 'list' as const, items })),
);

export const sectionTemplate: fc.Arbitrary<SectionTemplate> = fc.letrec((tie) => ({
  section: optional<SectionTemplate>(
    {
      id,
      title: localizedText,
      repeat,
      startOn,
      sheetAligned: fc.boolean(),
      optional: fc.boolean(),
      when: condition,
      children: fc.array(
        fc.oneof(
          { depthSize: 'small', withCrossShrink: true },
          optional({ page: id, startOn }, ['page']),
          tie('section') as fc.Arbitrary<SectionTemplate>,
        ),
        { maxLength: 3 },
      ),
    },
    ['id', 'title', 'children'],
  ),
})).section as fc.Arbitrary<SectionTemplate>;

const format = fc.constantFrom(...FORMAT_IDS);
const locale = fc.constantFrom(...LOCALES);

export const printSettings: fc.Arbitrary<PrintSettings> = fc.record({
  profile: fc.constantFrom(
    'home-duplex',
    'home-manual-duplex',
    'home-a5-2up',
    'home-a5-native',
    'home-booklet',
    'print-shop',
  ),
  margins: fc.record({ inner: mm, outer: mm, top: mm, bottom: mm }),
  printerSafeMargin: mm,
  outerRail: mm,
  bleed: mm,
  cropMarks: fc.boolean(),
  binding: fc.oneof(
    fc.record({
      kind: fc.constant('ring' as const),
      preset: fc.constantFrom('iso838-2hole', 'iso838-4hole', 'a5-6ring', 'custom'),
      holeCentreFromEdge: mm,
      holeDiameter: mm,
      holePositions: fc.array(mm, { maxLength: 6 }),
      punchGuides: fc.boolean(),
    }),
    fc.constant({ kind: 'sewn' as const }),
    fc.constant({ kind: 'none' as const }),
  ),
  pageNumbers: fc.boolean(),
  color: fc.constantFrom('color', 'grayscale'),
  calibrationPage: fc.boolean(),
});

export const generationConfig: fc.Arbitrary<GenerationConfig> = optional<GenerationConfig>(
  {
    templateId: id,
    format,
    locale,
    startDate: isoDate,
    durationMonths: fc.integer({ min: 1, max: 12 }),
    monthMode: fc.constantFrom('calendar', 'rolling'),
    weekOwnership: fc.constantFrom('monday', 'iso-thursday'),
    dailyLayout: fc.constantFrom('spread', 'one-per-page', 'two-per-page'),
    weeklyLayout: fc.constantFrom('spread', 'single'),
    quoteCadence: fc.constantFrom('daily', 'weekly', 'none'),
    volumes: fc.constantFrom(1, 2, 6),
    variables: fc.dictionary(
      fc.stringMatching(/^[a-z][a-zA-Z]{0,10}$/),
      optional(
        {
          value: fc.oneof(text, fc.integer(), fc.boolean()),
          personal: fc.boolean(),
        },
        ['value'],
      ),
      { maxKeys: 3 },
    ),
  },
  [
    'templateId',
    'format',
    'locale',
    'durationMonths',
    'monthMode',
    'weekOwnership',
    'dailyLayout',
    'weeklyLayout',
    'quoteCadence',
    'volumes',
    'variables',
  ],
);

export const plannerTemplate: fc.Arbitrary<PlannerTemplate> = fc.record({
  schemaVersion: fc.constant(1),
  id,
  version: fc.constantFrom('1.0.0', '0.1.0'),
  name: localizedText,
  description: localizedText,
  supportedFormats: fc.uniqueArray(format, { minLength: 1 }),
  supportedLocales: fc.uniqueArray(locale, { minLength: 1 }),
  defaults: fc.record({
    print: printSettings,
    theme: fc.dictionary(jsonKey, text, { maxKeys: 3 }),
    generation: generationConfig.map((g) => {
      const { variables: _v, ...rest } = g;
      return rest;
    }),
  }),
  pageTemplates: fc.dictionary(id, pageTemplate, { maxKeys: 3 }),
  sections: fc.array(sectionTemplate, { maxLength: 3 }),
  variables: fc.array(
    fc.record({
      name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,10}$/),
      label: localizedText,
      type: fc.constantFrom('text', 'date', 'number'),
      personal: fc.boolean(),
    }),
    { maxLength: 3 },
  ),
  contentLibraryRefs: fc.array(id, { maxLength: 3 }),
});

export const contentItem: fc.Arbitrary<ContentItem> = optional<ContentItem>(
  {
    id,
    kind: fc.constantFrom('quote', 'affirmation', 'prompt', 'sos-step', 'warning-sign', 'exercise'),
    text: localizedText,
    author: text,
    source: text,
    license: fc.constantFrom('original', 'public-domain', 'cc-by', 'user'),
    categories: fc.array(text, { maxLength: 3 }),
    tags: fc.array(text, { maxLength: 3 }),
    scope: optional(
      {
        months: fc.array(fc.integer({ min: 1, max: 12 }), { maxLength: 3 }),
        weeks: fc.array(fc.integer({ min: 1, max: 60 }), { maxLength: 3 }),
      },
      [],
    ),
    review: optional(
      { en: fc.constantFrom('draft', 'reviewed'), pl: fc.constantFrom('draft', 'reviewed') },
      [],
    ),
  },
  ['id', 'kind', 'text', 'license', 'categories', 'tags'],
);

export const contentLibrary: fc.Arbitrary<ContentLibrary> = fc.record({
  schemaVersion: fc.constant(1),
  library: id,
  items: fc.array(contentItem, { maxLength: 4 }),
});

const blockPatch = optional({ props: json, style: blockStyle, hidden: fc.boolean() }, []);

export const pageInstance: fc.Arbitrary<PageInstance> = optional<PageInstance>(
  {
    key: fc.stringMatching(/^[a-z0-9][a-z0-9/-]{0,30}$/),
    templateId: id,
    context: optional(
      {
        date: isoDate,
        dates: fc.array(isoDate, { maxLength: 2 }),
        monthIndex: fc.nat(12),
        weekIndex: fc.nat(60),
        dayIndex: fc.nat(6),
        volume: fc.integer({ min: 1, max: 6 }),
      },
      [],
    ),
    enabled: fc.boolean(),
    origin: fc.constantFrom('generated', 'manual', 'filler'),
    overrides: fc.dictionary(id, blockPatch, { maxKeys: 2 }) as fc.Arbitrary<
      PageInstance['overrides']
    >,
    contentAssignments: fc.dictionary(id, id, { maxKeys: 2 }),
  },
  ['key', 'templateId', 'context', 'enabled', 'origin'],
);

export const sectionNode: fc.Arbitrary<SectionNode> = fc.letrec((tie) => ({
  node: optional<SectionNode>(
    {
      key: fc.stringMatching(/^[a-z0-9][a-z0-9/-]{0,20}$/),
      title: localizedText,
      enabled: fc.boolean(),
      startOn,
      sheetAligned: fc.boolean(),
      children: fc.array(
        fc.oneof(
          { depthSize: 'small', withCrossShrink: true },
          pageInstance,
          tie('node') as fc.Arbitrary<SectionNode>,
        ),
        { maxLength: 4 },
      ),
    },
    ['key', 'title', 'enabled', 'children'],
  ),
})).node as fc.Arbitrary<SectionNode>;

export const plannerProject: fc.Arbitrary<PlannerProject> = fc.record({
  schemaVersion: fc.constant(1),
  id,
  meta: optional(
    {
      name: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 40 }),
      createdAt: isoDateTime,
      updatedAt: isoDateTime,
      lastExport: optional(
        {
          at: isoDateTime,
          kind: fc.constantFrom('pdf', 'json'),
          pageCount: fc.nat(1000),
        },
        ['at', 'kind'],
      ),
    },
    ['name', 'createdAt', 'updatedAt'],
  ),
  templateSource: fc.record({ id, version: fc.constant('1.0.0') }),
  template: plannerTemplate,
  content: fc.array(contentLibrary, { maxLength: 2 }),
  generation: generationConfig,
  print: printSettings,
  locale,
  format,
  i18nOptions: fc.record({
    grammaticalGender: fc.constantFrom('slash', 'feminine', 'masculine', 'neutral'),
  }),
  document: fc.record({ root: sectionNode }),
});
