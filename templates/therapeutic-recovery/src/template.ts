import { readFileSync } from 'node:fs';
import { HALT_B_ROWS } from '@planner/blocks';
import { moduleOff, moduleOn } from '@planner/core';
import type {
  BlockInstance,
  BlockVariant,
  Condition,
  JsonPatchOp,
  LayoutNode,
  Length,
  ModuleDefinition,
  PageTemplate,
  PlannerTemplate,
  PresetDefinition,
  SectionTemplate,
} from '@planner/schema';
import { TEMPLATE_MIGRATIONS, defaultPrintSettings } from '@planner/schema';
import { L, block, fr, mmH, pointerToBlock, railBlock, row, stack } from './dsl';
import { GUIDES, SAMPLES, SAMPLES_NEUTRAL } from './samples';

// ---------------------------------------------------------------------------------------------
// Modules and presets (ADR-0010)

const RECOVERY = 'recovery';
const HALT = 'halt';
const CBT = 'cbt';
const START = 'start';
const DAYPLUS = 'dayplus';

const MODULES: ModuleDefinition[] = [
  {
    id: START,
    name: L('A good start', 'Na dobry początek'),
    description: L(
      'Pages at the front: an agreement with yourself (with the recovery module, the therapeutic contract instead), your vision of a good life, more and less, values, strengths, and what restores you.',
      'Strony na początku: umowa ze sobą (z modułem zdrowienia zamiast niej kontrakt terapeutyczny), wizja dobrego życia, więcej i mniej, wartości, mocne strony oraz to, co Cię regeneruje.',
    ),
    default: true,
  },
  {
    id: RECOVERY,
    name: L('Recovery and sobriety', 'Zdrowienie i trzeźwość'),
    description: L(
      'Sobriety day counter, craving, triggers, AA and group meetings, the contract and safety rules, and the crisis and relapse prevention section.',
      'Licznik dni trzeźwości, głód, wyzwalacze, mityngi AA i grupy, kontrakt i zasady bezpieczeństwa oraz sekcja kryzysowa i zapobiegania nawrotom.',
    ),
    default: true,
  },
  {
    id: HALT,
    name: L('HALT-B check', 'Skala HALT-B'),
    description: L(
      'A daily check of hunger, anger, loneliness, tiredness and boredom, and its summary in "My week".',
      'Codzienna ocena głodu fizycznego, złości, samotności, zmęczenia i nudy oraz jej podsumowanie w „Moim tygodniu”.',
    ),
    default: true,
  },
  {
    id: CBT,
    name: L('Situation analysis (CBT)', 'Analiza sytuacji (CBT)'),
    description: L(
      'A weekly page for one situation: the thought, the feeling, what I did, and what could help next time.',
      'Cotygodniowa strona na jedną sytuację: myśl, uczucie, działanie i to, co mogłoby pomóc następnym razem.',
    ),
    default: false,
  },
  {
    id: DAYPLUS,
    name: L('Day+', 'Dzień+'),
    description: L(
      'The full "My 24 hours" and "something important, something pleasant" on the day page, in place of the plan of the day.',
      'Pełne „Moje 24 godziny” oraz „coś ważnego, coś przyjemnego” na stronie dnia, zamiast planu dnia.',
    ),
    default: false,
  },
];

const PRESETS: PresetDefinition[] = [
  {
    id: 'recovery-edition',
    name: L('Recovery Edition', 'Recovery Edition'),
    description: L(
      'For recovery from addiction: sobriety, craving, HALT-B and the crisis section.',
      'Dla zdrowienia z uzależnienia: trzeźwość, głód, HALT-B i sekcja kryzysowa.',
    ),
    modules: { [START]: true, [RECOVERY]: true, [HALT]: true, [CBT]: false, [DAYPLUS]: false },
  },
  {
    id: 'balance',
    name: L('Balance', 'Balance'),
    description: L(
      'Everyday life, balance and a good life, without addiction and therapy wording.',
      'Codzienność, równowaga i dobre życie, bez języka uzależnienia i terapii.',
    ),
    modules: { [START]: true, [RECOVERY]: false, [HALT]: true, [CBT]: false, [DAYPLUS]: false },
  },
  {
    id: 'basic',
    name: L('Basic', 'Podstawowy'),
    description: L(
      'A simple day planner: no front matter, recovery, HALT-B or situation analysis.',
      'Prosty planer dnia: bez stron wstępnych, zdrowienia, HALT-B i analizy sytuacji.',
    ),
    modules: { [START]: false, [RECOVERY]: false, [HALT]: false, [CBT]: false, [DAYPLUS]: false },
  },
];

/** The recovery module is off: the planner uses neutral, everyday wording. */
const BALANCE = moduleOff(RECOVERY);
/** The same, in A5, for blocks whose A5 layout differs. */
const BALANCE_A5: Condition = { and: [BALANCE, { '==': [{ var: 'format' }, 'A5'] }] };

type Tagged = LayoutNode | BlockInstance;
/** Applies `fn` to a block, or to every block inside a stack or row. */
const retag = <T extends Tagged>(node: T, fn: (b: BlockInstance) => BlockInstance): T =>
  ('kind' in node
    ? node.kind === 'block'
      ? { ...node, block: fn(node.block) }
      : { ...node, children: node.children.map((c) => retag(c, fn)) }
    : fn(node)) as T;

/** Prints only while all these modules are on. */
const needs = <T extends Tagged>(node: T, ...modules: string[]): T =>
  retag(node, (b) => ({
    ...b,
    visibility: modules.length === 1 ? moduleOn(modules[0]!) : { and: modules.map(moduleOn) },
  }));

/** Other props while a condition holds; the first matching variant wins, so list A5 first. */
/** Blocks printed only while a module is off: what the module replaces. */
const without = <T extends Tagged>(node: T, module: string): T =>
  retag(node, (b) => ({ ...b, visibility: moduleOff(module) }));

const varies = <T extends Tagged>(node: T, ...variants: BlockVariant[]): T =>
  retag(node, (b) => ({ ...b, variants }));

/** Neutral "what helped" choices for planners without the recovery module. */
const HELPED_BALANCE = [
  L('talking to someone', 'rozmowa z kimś'),
  L('exercise', 'ruch'),
  L('rest / sleep', 'odpoczynek / sen'),
  L('a proper meal', 'dobry posiłek'),
  L('family / friends', 'rodzina / przyjaciele'),
  L('work / hobby', 'praca / hobby'),
  L('meditation / prayer', 'medytacja / modlitwa'),
  L('time outdoors', 'czas na zewnątrz'),
  L('time for myself', 'czas dla siebie'),
  L('asking for help', 'prośba o pomoc'),
  L('setting a boundary', 'postawiona granica'),
  L('other:', 'inne:'),
];

/** What weighed on me: the everyday counterpart of the trigger list. */
const STRAIN_BALANCE = [
  L('nothing in particular', 'nic szczególnego'),
  L('work / duties', 'praca / obowiązki'),
  L('relationships', 'relacje'),
  L('a conflict', 'konflikt'),
  L('money', 'pieniądze'),
  L('health', 'zdrowie'),
  L('tiredness / little sleep', 'zmęczenie / mało snu'),
  L('rush', 'pośpiech'),
  L('loneliness', 'samotność'),
  L('boredom', 'nuda'),
  L('worries', 'zmartwienia'),
  L('other:', 'inne:'),
];

/** Weekly day markers without AA, groups, therapy, recovery actions and high-risk days. */
const MARKERS_BALANCE = ['doctor', 'exercise', 'custom'];

/** Wheel of Life areas (S2); the last is recovery, or meaning without the recovery module. */
const WHEEL = [
  L('Health', 'Zdrowie'),
  L('Emotions', 'Emocje'),
  L('Relationships', 'Relacje'),
  L('Work / study', 'Praca / nauka'),
  L('Finances', 'Finanse'),
  L('Growth', 'Rozwój'),
  L('Rest', 'Odpoczynek'),
  L('Recovery', 'Zdrowienie'),
];
const WHEEL_BALANCE = [...WHEEL.slice(0, 7), L('Meaning and spirituality', 'Sens i duchowość')];

/**
 * "Day by Day" ("Dzień po Dniu"), the 6-month therapeutic recovery planner (brief §5–§21),
 * authored in TypeScript for type checking and compiled to template.json, the data the app
 * loads. The layout follows the reference demo with the daily spread reversed: morning and day
 * on the left, evening on the right (design §5.3).
 */

/** A line to write a number or word on; example fills write on it (see withBlanks). */
const BLANK = '__________';
/** A short line, for a number such as 7 or 6,5. */
const NUM = '_____';

/** Morning check-in fields: label, blank for the number, unit. */
const CHECKIN: Array<[en: string, pl: string, unit: string]> = [
  ['Mood', 'Nastrój', '/10'],
  ['Energy', 'Energia', '/10'],
  ['Tension', 'Napięcie', '/10'],
  ['Craving', 'Głód', '/10'],
  ['Sleep', 'Sen', 'h'],
  ['quality', 'jakość', '/5'],
];

/**
 * The check-in as lines of `perLine` fields. Each field is held together by non-breaking spaces,
 * so a text block aligned to `spread` spaces the fields out evenly across the line.
 */
const checkin = (perLine: number[], craving = true) => {
  const text = (lang: 0 | 1) => {
    const fields = CHECKIN.filter((f) => craving || f[0] !== 'Craving').map((f) =>
      [f[lang], NUM, f[2]].join(' '),
    );
    let at = 0;
    return perLine.map((n) => fields.slice(at, (at += n)).join(' · ')).join('\n');
  };
  return L(text(0), text(1));
};

/** A day of the weekly spread; without the recovery module its markers leave out AA and groups. */
const dayStrip = (id: string, weekday: number) =>
  varies(block(id, 'day-strip', { weekday }), {
    when: BALANCE,
    props: { markers: MARKERS_BALANCE },
  });

/** A list of printed choices to tick. */
const ticks = (
  id: string,
  title: ReturnType<typeof L> | undefined,
  items: ReturnType<typeof L>[],
  height: Length,
) =>
  block(
    id,
    'numbered-list',
    { ...(title ? { title } : {}), marker: 'checkbox', items, count: items.length, lineHeight: 5 },
    { height },
  );

/** The daily date line; without the recovery module it has no sobriety day counter. */
const dateHeader = (size: { width?: Length; height?: Length }) =>
  varies(block('date', 'day-header', { inline: true }, size), {
    when: BALANCE,
    props: { showSobriety: false },
  });

/** The day's quote in slightly smaller type, so it fits beside the date. */
const quoteBlock = (size: { width?: Length; height?: Length }): LayoutNode => {
  const node = block('quote', 'quote', {}, size);
  return node.kind === 'block'
    ? { ...node, block: { ...node.block, style: { fontSizePt: 8 } } }
    : node;
};

const heading = (id: string, text: ReturnType<typeof L>, height = 12) =>
  block(id, 'text', { text, variant: 'heading' }, { height: mmH(height) });
const caption = (id: string, text: ReturnType<typeof L>, height = 8) =>
  block(id, 'text', { text, variant: 'caption' }, { height: mmH(height) });

/**
 * Adjustments for A5 (148 × 210 mm): fewer lines where space runs out (§5.3). A change is a block
 * property or a raw patch operation on the page template; operations apply in order, and block
 * pointers are taken from the unpatched body, so list block changes before insertions.
 */
function a5(
  template: PageTemplate,
  changes: Array<[blockId: string, path: string, value: unknown] | JsonPatchOp>,
): PageTemplate {
  const ops: JsonPatchOp[] = changes.map((change) => {
    if (!Array.isArray(change)) return change;
    const [id, path, value] = change;
    const pointer = pointerToBlock(template.body, id);
    if (!pointer) throw new Error(`A5 override: no block "${id}" in ${template.id}`);
    // 'add' sets or replaces a member, so it also works for props left at the block defaults.
    return { op: 'add', path: `${pointer}/${path}`, value: value as JsonPatchOp['value'] };
  });
  return { ...template, formatOverrides: { A5: ops } };
}

// ---------------------------------------------------------------------------------------------
// Introduction

/** The line apple from the YAPCO brand concepts, embedded so that template.json stays self-contained. */
const COVER_APPLE = `data:image/png;base64,${readFileSync(
  new URL('../assets/cover-apple.png', import.meta.url),
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
        { src: COVER_APPLE, alt: L('An apple with a tick', 'Jabłko z ptaszkiem') },
        { height: fr(3) },
      ),
      stack(
        [
          heading('title', L('Day by Day', 'Dzień po Dniu'), 10),
          block(
            'subtitle',
            'text',
            {
              text: L(
                'A planner for the everyday, balance and a good life',
                'Planer codzienności, równowagi i dobrego życia',
              ),
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
      // The start date chosen in the creator; an undated planner prints a line to write on.
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
      block(
        'motto',
        'text',
        {
          text: L(
            'I do not have to change my whole life today.\nIt is enough to live this day with awareness.',
            'Nie muszę zmieniać całego życia dzisiaj.\nWystarczy, że świadomie przeżyję ten dzień.',
          ),
          variant: 'caption',
        },
        { height: mmH(12) },
      ),
    ],
    { gap: 6 },
  ),
};

/** The "How to use" text for the modules in use: recovery wording, and the HALT sentence. */
function howToText(recovery: boolean, halt: boolean) {
  const en = [
    'IN THE MORNING, stop for a few minutes. Check how you feel, what you need today, what really matters and what to watch out for. The left page has a quick check-in (mood, energy, tension' +
      (recovery ? ', craving' : '') +
      ' and sleep), ' +
      (recovery
        ? 'one action that protects your sobriety today'
        : 'one way you will take care of yourself today') +
      ', at most three priorities and a plan for the day. Do not plan a perfect day; plan a day you can live through.',
    'DURING THE DAY, notice your needs, tension' +
      (recovery ? ', craving' : '') +
      ', tiredness and contact with people.' +
      (halt ? ' Check {{haltName}}: are you {{haltFeelings}}?' : '') +
      ' If the day does not go to plan, change the plan, not yourself.',
    'IN THE EVENING, look at the day with curiosity, not judgement, on the right page: ' +
      (recovery ? 'what was hard and what threatened your sobriety' : 'what was hard') +
      ', what helped, a small victory, what you are grateful for, and what to take into tomorrow.',
    'Each week opens with a spread for the week’s focus and goals, and ends with “My week”, a short review. Each month opens with a calendar and your intentions, and ends with the Wheel of Life and a short review.',
    ...(recovery
      ? [
          'The crisis section at the back opens with your plan for a hard moment, then how you respond to craving, what to do when nothing comes to mind, your warning signs and relapse chain, a plan for after a slip, your balance of gains and losses, your support network and two craving cards. Fill it in early, and keep it within reach.',
        ]
      : []),
    'Write by hand. This is not a test; it is a tool for getting to know yourself.',
  ];
  const pl = [
    'RANO zatrzymaj się na kilka minut. Sprawdź, jak się czujesz, czego dziś potrzebujesz, co jest naprawdę ważne i na co warto uważać. Na lewej stronie jest szybki check-in (nastrój, energia, napięcie' +
      (recovery ? ', głód' : '') +
      ' i sen), ' +
      (recovery
        ? 'jedno działanie, którym chronisz dziś trzeźwość'
        : 'jeden sposób, w jaki dziś o siebie zadbasz') +
      ', najwyżej trzy priorytety i plan dnia. Nie planuj idealnego dnia; zaplanuj dzień możliwy do przeżycia.',
    'W CIĄGU DNIA zauważaj swoje potrzeby, napięcie' +
      (recovery ? ', głód' : '') +
      ', zmęczenie i kontakt z ludźmi.' +
      (halt ? ' Sprawdzaj {{haltName}}: czy jesteś {{haltFeelings}}?' : '') +
      ' Jeśli dzień nie idzie zgodnie z planem, zmień plan, nie siebie.',
    'WIECZOREM na prawej stronie spójrz na dzień z ciekawością, nie z oceną: ' +
      (recovery ? 'co było trudne i co zagroziło Twojej trzeźwości' : 'co było trudne') +
      ', co pomogło, małe zwycięstwo, za co jesteś {g:wdzięczny|wdzięczna} i co chcesz zabrać w jutro.',
    'Każdy tydzień zaczyna się rozkładówką z myślą przewodnią i celami tygodnia, a kończy „Moim tygodniem”, krótkim podsumowaniem. Każdy miesiąc otwiera kalendarz i Twoje intencje, a zamyka Koło Życia i krótkie podsumowanie.',
    ...(recovery
      ? [
          'Sekcja kryzysowa na końcu zaczyna się od planu na trudny moment, potem jest to, jak reagujesz na głód, co robić, gdy nic nie przychodzi do głowy, sygnały ostrzegawcze i łańcuch nawrotu, plan po potknięciu, bilans zysków i strat, sieć wsparcia oraz dwie karty głodu. Wypełnij ją wcześnie i trzymaj pod ręką.',
        ]
      : []),
    'Pisz odręcznie. To nie jest sprawdzian; to narzędzie do poznawania siebie.',
  ];
  return L(en.join('\n\n'), pl.join('\n\n'));
}

const howTo = a5(
  {
    id: 'how-to',
    name: L('How to use this planner', 'Jak korzystać z planera'),
    body: stack([
      heading('heading', L('How to use this planner', 'Jak korzystać z planera')),
      // Worded for the modules in use; the first matching variant wins.
      varies(
        block(
          'body',
          'text',
          {
            variant: 'body',
            text: howToText(true, true),
          },
          { height: fr(3) },
        ),
        { when: { and: [BALANCE, moduleOff(HALT)] }, props: { text: howToText(false, false) } },
        { when: BALANCE, props: { text: howToText(false, true) } },
        { when: moduleOff(HALT), props: { text: howToText(true, false) } },
      ),
      block(
        'notes',
        'writing-area',
        { title: L('My notes', 'Moje notatki'), pattern: 'dots' },
        { height: fr(2) },
      ),
    ]),
    // A5: the text needs most of the page; the notes get what is left.
  },
  [
    ['notes', 'size/height', { mm: 34 }],
    ['body', 'size/height', { fr: 1 }],
  ],
);

// ---------------------------------------------------------------------------------------------
// A good start (front matter shared by both editions; the "start" module)

/** Lines to write on under a question, in the front matter. */
const prompt = (id: string, title: ReturnType<typeof L>, height: Length = fr(1)) =>
  block(id, 'writing-area', { title, pattern: 'lines' }, { height });

const agreement: PageTemplate = {
  id: 'agreement',
  name: L('My agreement with myself', 'Moja umowa ze sobą'),
  rationale: L(
    'A commitment without clinical language: what to take care of, do more and less of, and one promise, signed by the owner.',
    'Zobowiązanie bez języka klinicznego: o co dbać, czego robić więcej i mniej oraz jedna obietnica, podpisana przez właściciela.',
  ),
  body: stack(
    [
      heading('heading', L('My agreement with myself', 'Moja umowa ze sobą')),
      caption(
        'how',
        L(
          'This planner is here to help me live more consciously, not perfectly.',
          'Ten planer ma mi pomagać żyć bardziej świadomie, a nie żyć idealnie.',
        ),
      ),
      prompt(
        'care',
        L(
          'In the coming months I want to take better care of:',
          'Przez najbliższy okres chcę bardziej dbać o:',
        ),
      ),
      prompt('more', L('I want to do more often:', 'Chcę częściej:')),
      prompt('less', L('I want to do less often:', 'Chcę rzadziej:')),
      prompt('learn', L('I want to learn:', 'Chcę nauczyć się:')),
      prompt(
        'remember',
        L('When it gets hard, I want to remember that:', 'Kiedy będzie trudno, chcę pamiętać, że:'),
      ),
      prompt('dont-have-to', L('I do not have to:', 'Nie muszę:')),
      prompt('ask-for-help', L('I can ask for help when:', 'Mogę prosić o pomoc, gdy:')),
      block(
        'promise',
        'writing-area',
        {
          title: L('One thing I promise myself:', 'Jedna rzecz, którą obiecuję sobie:'),
          pattern: 'lines',
          framed: true,
        },
        { height: mmH(22) },
      ),
      block(
        'signature',
        'text',
        {
          text: L(
            `I sign this agreement with myself. Signature ${BLANK}${BLANK} · date ${BLANK}`,
            `Podpisuję tę umowę ze sobą. Podpis ${BLANK}${BLANK} · data ${BLANK}`,
          ),
          variant: 'body',
        },
        { height: mmH(8) },
      ),
    ],
    { gap: 3 },
  ),
};

const goodLife: PageTemplate = {
  id: 'good-life',
  name: L('My vision of a good life', 'Moja wizja dobrego życia'),
  rationale: L(
    'A direction rather than a list of goals: how I want to feel, treat myself and others, and what to have more and less of.',
    'Kierunek zamiast listy celów: jak chcę się czuć, traktować siebie i innych oraz czego chcę mieć więcej i mniej.',
  ),
  body: stack(
    [
      heading('heading', L('A good life means to me…', 'Dobre życie oznacza dla mnie…')),
      prompt('feel', L('How do I want to feel day to day?', 'Jak chcę czuć się na co dzień?')),
      prompt('myself', L('How do I want to treat myself?', 'Jak chcę traktować siebie?')),
      prompt('others', L('How do I want to treat others?', 'Jak chcę traktować innych?')),
      prompt('more-time', L('What do I want more time for?', 'Na co chcę mieć więcej czasu?')),
      prompt('less', L('What do I want less of?', 'Czego chcę mieć mniej?')),
      prompt(
        'in-a-year',
        L(
          'What would I like to say about my life a year from now?',
          'Co {g:chciałbym|chciałabym} powiedzieć o swoim życiu za rok?',
        ),
      ),
      block(
        'build',
        'text',
        {
          text: L(
            'I do not only ask: “What do I want to avoid?”\nI also ask: “What do I want to build?”',
            'Nie pytam tylko: „Czego chcę uniknąć?”\nPytam również: „Co chcę zbudować?”',
          ),
          variant: 'subheading',
          align: 'center',
        },
        { height: mmH(14) },
      ),
    ],
    { gap: 3 },
  ),
};

/** Ruled lines under a column heading ("MORE" / "LESS"). */
const column = (id: string, title: ReturnType<typeof L>) =>
  block(id, 'writing-area', { title, pattern: 'lines', pitch: 9 }, { height: fr(1) });

const moreLess: PageTemplate = {
  id: 'more-less',
  name: L('More / less', 'Więcej / mniej'),
  rationale: L(
    'A quick look at everyday life in two columns; it later feeds the monthly and weekly goals.',
    'Szybkie spojrzenie na codzienność w dwóch kolumnach; później zasila cele miesiąca i tygodnia.',
  ),
  body: stack(
    [
      heading('heading', L('In my life I want…', 'W moim życiu chcę…')),
      caption(
        'how',
        L(
          'For example, more: calm · movement · closeness · rest · curiosity · presence. Less: rush · tension · isolation · chaos · putting things off · acting on autopilot.',
          'Na przykład więcej: spokoju · ruchu · bliskości · odpoczynku · ciekawości · obecności. Mniej: pośpiechu · napięcia · izolacji · chaosu · odkładania · działania automatycznego.',
        ),
        12,
      ),
      row([column('more', L('More', 'Więcej')), column('less', L('Less', 'Mniej'))], {
        height: fr(1),
        gap: 8,
      }),
    ],
    { gap: 4 },
  ),
};

const VALUE_WORDS = [
  L('family', 'rodzina'),
  L('health', 'zdrowie'),
  L('closeness', 'bliskość'),
  L('friendship', 'przyjaźń'),
  L('honesty', 'uczciwość'),
  L('security', 'bezpieczeństwo'),
  L('growth', 'rozwój'),
  L('knowledge', 'wiedza'),
  L('freedom', 'wolność'),
  L('calm', 'spokój'),
  L('responsibility', 'odpowiedzialność'),
  L('curiosity', 'ciekawość'),
  L('courage', 'odwaga'),
  L('kindness', 'życzliwość'),
  L('independence', 'niezależność'),
  L('creativity', 'twórczość'),
  L('balance', 'równowaga'),
  L('helping others', 'pomoc innym'),
  L('presence', 'obecność'),
  L('fun', 'zabawa'),
  L('other:', 'inne:'),
];

const values: PageTemplate = {
  id: 'values',
  name: L('My values', 'Moje wartości'),
  rationale: L(
    'Goals end; values are a direction. Ticking, then choosing five, and naming how they show in daily life.',
    'Cele się kończą, wartości są kierunkiem. Zaznaczenie, wybór pięciu i nazwanie, jak widać je w codziennym życiu.',
  ),
  body: stack(
    [
      heading('heading', L('What really matters to me?', 'Co jest dla mnie naprawdę ważne?')),
      caption('how', L('Tick at most ten.', 'Zaznacz najwyżej dziesięć.')),
      row(
        [
          ticks('values-1', undefined, VALUE_WORDS.slice(0, 7), fr(1)),
          ticks('values-2', undefined, VALUE_WORDS.slice(7, 14), fr(1)),
          ticks('values-3', undefined, VALUE_WORDS.slice(14), fr(1)),
        ],
        { height: mmH(48) },
      ),
      block(
        'top-five',
        'numbered-list',
        {
          title: L('My five most important values', 'Moje pięć najważniejszych wartości'),
          count: 5,
        },
        { height: mmH(50) },
      ),
      prompt(
        'living',
        L(
          'How will I know in daily life that I really live by them?',
          'Po czym poznam w codziennym życiu, że naprawdę nimi żyję?',
        ),
      ),
    ],
    { gap: 4 },
  ),
};

const strengths: PageTemplate = {
  id: 'strengths',
  name: L('My strengths', 'Moje mocne strony'),
  rationale: L(
    'Starting from what already works rather than what needs fixing: skills, pride, what others value, what carried me through before.',
    'Punkt wyjścia to to, co już działa, a nie to, co trzeba poprawić: umiejętności, duma, to, co cenią inni, i co pomagało wcześniej.',
  ),
  body: stack(
    [
      heading('heading', L('What can I already draw on?', 'Z czego już mogę korzystać?')),
      prompt('can-do', L('What can I already do?', 'Co już potrafię?')),
      prompt(
        'carried',
        L(
          'What helped me through hard times before?',
          'Co pomagało mi przechodzić przez trudne sytuacje?',
        ),
      ),
      prompt('proud', L('What am I proud of?', 'Z czego jestem {g:dumny|dumna}?')),
      prompt('valued', L('What do others value in me?', 'Co inni we mnie cenią?')),
      prompt('still-can', L('When it is hard, I can still…', 'Kiedy jest trudno, nadal potrafię…')),
    ],
    { gap: 3 },
  ),
};

const recharge: PageTemplate = {
  id: 'recharge',
  name: L('What restores me', 'Co mnie regeneruje'),
  rationale: L(
    'A ready personal list, so a hard day does not start from zero: what helps with five minutes, half an hour, an evening, and in particular states.',
    'Gotowa osobista lista, żeby trudny dzień nie zaczynał się od zera: co pomaga, gdy mam pięć minut, pół godziny, wieczór, i w konkretnych stanach.',
  ),
  body: stack(
    [
      heading('heading', L('My personal list for recharging', 'Moja osobista lista regeneracji')),
      prompt('five-minutes', L('When I have 5 minutes:', 'Gdy mam 5 minut:')),
      prompt('half-hour', L('When I have 30 minutes:', 'Gdy mam 30 minut:')),
      prompt('evening', L('When I have a free evening:', 'Gdy mam wolny wieczór:')),
      prompt('tense', L('When I am tense:', 'Gdy jestem {g:spięty|spięta}:')),
      prompt('lonely', L('When I feel lonely:', 'Gdy czuję samotność:')),
      prompt('tired', L('When I am tired:', 'Gdy jestem {g:zmęczony|zmęczona}:')),
      prompt('movement', L('When I need to move:', 'Gdy potrzebuję ruchu:')),
      prompt('quiet', L('When I need quiet:', 'Gdy potrzebuję ciszy:')),
    ],
    { gap: 3 },
  ),
};

const contract: PageTemplate = {
  id: 'contract',
  name: L('Therapeutic contract', 'Kontrakt terapeutyczny'),
  body: stack([
    heading('heading', L('My therapeutic contract', 'Mój kontrakt terapeutyczny')),
    block(
      'intro',
      'text',
      {
        variant: 'body',
        text: L(
          'Write down, in your own words, what you commit to during these six months. You can agree it with your therapist.',
          'Zapisz własnymi słowami, do czego zobowiązujesz się w ciągu tych sześciu miesięcy. Możesz uzgodnić to ze swoim terapeutą lub terapeutką.',
        ),
      },
      { height: mmH(12) },
    ),
    block(
      'commitments',
      'numbered-list',
      { title: L('I commit to', 'Zobowiązuję się'), count: 8, lineHeight: 9 },
      { height: fr(1) },
    ),
    row(
      [
        block('signature', 'writing-area', {
          title: L('My signature', 'Mój podpis'),
          pattern: 'lines',
          pitch: 10,
        }),
        block('therapist', 'writing-area', {
          title: L('Therapist', 'Terapeuta / terapeutka'),
          pattern: 'lines',
          pitch: 10,
        }),
        block('date', 'writing-area', { title: L('Date', 'Data'), pattern: 'lines', pitch: 10 }),
      ],
      { height: mmH(22) },
    ),
  ]),
};

const safetyRules: PageTemplate = {
  id: 'safety-rules',
  name: L('Safety rules', 'Zasady bezpieczeństwa'),
  body: stack([
    heading('heading', L('My safety rules', 'Moje zasady bezpieczeństwa')),
    block(
      'rules',
      'numbered-list',
      {
        count: 10,
        lineHeight: 9,
        items: [
          L(
            'I do not keep alcohol or substances at home.',
            'Nie trzymam w domu alkoholu ani substancji.',
          ),
          L(
            'When a craving comes, I call someone before I decide anything.',
            'Gdy pojawia się głód, dzwonię do kogoś, zanim cokolwiek zdecyduję.',
          ),
          L(
            'I avoid places and people linked to my drinking or using.',
            'Unikam miejsc i osób związanych z piciem lub używaniem.',
          ),
          L('I eat, sleep and rest regularly.', 'Regularnie jem, śpię i odpoczywam.'),
          L(
            'I go to my meetings and therapy even when I do not feel like it.',
            'Chodzę na mityngi i terapię, nawet gdy nie mam ochoty.',
          ),
        ],
      },
      { height: fr(1) },
    ),
  ]),
};

// ---------------------------------------------------------------------------------------------
// Month

const monthDivider: PageTemplate = {
  id: 'month-divider',
  name: L('Month divider', 'Przekładka miesiąca'),
  rationale: L(
    'A right-hand page that starts each month on a new sheet, so months can be printed and filed in the ring binder one at a time.',
    'Prawa strona rozpoczynająca każdy miesiąc na nowym arkuszu, dzięki czemu miesiące można drukować i wpinać do segregatora osobno.',
  ),
  body: stack([
    block('top', 'spacer', {}, { height: fr(2) }),
    heading('month', L('{{monthName}}', '{{monthName}}'), 16),
    block(
      'intention',
      'writing-area',
      {
        title: L('One word for this month', 'Jedno słowo na ten miesiąc'),
        pattern: 'lines',
        pitch: 9,
      },
      { height: mmH(20) },
    ),
    block('bottom', 'spacer', {}, { height: fr(3) }),
  ]),
};

const monthOpenLeft = a5(
  {
    id: 'month-open-left',
    name: L('Month opening (left)', 'Otwarcie miesiąca (lewa)'),
    spread: { group: 'month-open', position: 'left' },
    body: stack([
      heading('month', L('{{monthName}}', '{{monthName}}')),
      block('calendar', 'calendar-grid', { columns: [0, 4] }, { height: mmH(110) }),
      block(
        'how-live',
        'writing-area',
        {
          title: L('How do I want to live this month?', 'Jak chcę przeżyć ten miesiąc?'),
          pattern: 'lines',
        },
        { height: mmH(18) },
      ),
      block(
        'intention',
        'writing-area',
        { title: L('My main intention', 'Moja główna intencja'), pattern: 'lines' },
        { height: mmH(18) },
      ),
      block(
        'goals',
        'numbered-list',
        {
          title: L('3 things that really matter', '3 rzeczy, które są naprawdę ważne'),
          count: 3,
          marker: 'checkbox',
        },
        { height: mmH(34) },
      ),
      block(
        'not-perfect',
        'writing-area',
        {
          title: L("What I don't have to do perfectly", 'Tego nie muszę robić idealnie'),
          pattern: 'lines',
        },
        { height: fr(1) },
      ),
    ]),
  },
  [
    ['calendar', 'size/height', { mm: 76 }],
    ['how-live', 'size/height', { mm: 14 }],
    ['intention', 'size/height', { mm: 14 }],
    ['goals', 'size/height', { mm: 28 }],
  ],
);

/** "My month in practice" (S2): one line per area of life; recovery in the recovery module. */
const PRACTICE = [
  L('For my health', 'Dla mojego zdrowia'),
  L('For relationships', 'Dla relacji'),
  L('For rest', 'Dla odpoczynku'),
  L('For growth', 'Dla rozwoju'),
  L('For pleasure', 'Dla przyjemności'),
  L('For my recovery', 'Dla mojego zdrowienia'),
];

const monthOpenRight = a5(
  {
    id: 'month-open-right',
    name: L('Month opening (right)', 'Otwarcie miesiąca (prawa)'),
    spread: { group: 'month-open', position: 'right' },
    body: stack([
      // A value from "What really matters to me" at the front, to practise this month.
      block(
        'value',
        'writing-area',
        {
          title: L(
            'The value I want to practise this month',
            'Wartość, którą chcę w tym miesiącu praktykować',
          ),
          pattern: 'lines',
          pitch: 6,
        },
        { height: mmH(12) },
      ),
      block('calendar', 'calendar-grid', { columns: [4, 7] }, { height: mmH(110) }),
      varies(
        block(
          'practice',
          'table',
          {
            title: L('My month in practice', 'Mój miesiąc w praktyce'),
            rows: PRACTICE,
            columns: [],
            ruling: 'lines',
          },
          { height: mmH(52) },
        ),
        { when: BALANCE, props: { rows: PRACTICE.slice(0, 5) } },
      ),
      row(
        [
          block('remember', 'writing-area', {
            title: L('This month I want to remember…', 'W tym miesiącu chcę pamiętać o…'),
            pattern: 'lines',
            framed: true,
          }),
          varies(
            block('appointments', 'writing-area', {
              title: L('Meetings, therapy and appointments', 'Mityngi, terapia i wizyty'),
              pattern: 'lines',
            }),
            {
              when: BALANCE,
              props: { title: L('Important dates and appointments', 'Ważne terminy i wizyty') },
            },
          ),
        ],
        { height: fr(1) },
      ),
    ]),
  },
  [
    ['calendar', 'size/height', { mm: 76 }],
    ['practice', 'size/height', { mm: 42 }],
  ],
);

const weekLeft: PageTemplate = {
  id: 'week-left',
  name: L('Week (left)', 'Tydzień (lewa)'),
  spread: { group: 'week', position: 'left' },
  rationale: L(
    'Weekly goals sit in the outer column, near the page edge, where they stay visible and clear of the binding.',
    'Cele tygodnia są w zewnętrznej kolumnie, przy krawędzi strony: dobrze widoczne i z dala od oprawy.',
  ),
  outerRailWidth: 34,
  outerRail: [
    {
      ...railBlock(
        'goals',
        'numbered-list',
        {
          title: L('Three most important things', 'Trzy najważniejsze rzeczy'),
          count: 3,
          marker: 'checkbox',
        },
        fr(1),
      ),
      // A light frame sets the goals apart from the days, like the "This week remember" box.
      style: { borderWidthPt: 0.3, borderToken: 'line', radius: 1.5, padding: 2.5 },
    },
  ],
  body: stack([
    block(
      'range',
      'text',
      { text: L('Week {{weekRange}}', 'Tydzień {{weekRange}}'), variant: 'subheading' },
      { height: mmH(8) },
    ),
    block(
      'intention',
      'writing-area',
      { title: L('My intention for this week', 'Moja intencja na ten tydzień'), pattern: 'lines' },
      { height: mmH(14) },
    ),
    block(
      'remember',
      'writing-area',
      {
        title: L('This week remember:', 'W tym tygodniu pamiętaj o:'),
        pattern: 'lines',
        framed: true,
      },
      { height: mmH(28) },
    ),
    dayStrip('mon', 0),
    dayStrip('tue', 1),
    dayStrip('wed', 2),
  ]),
};

const weekRight: PageTemplate = {
  id: 'week-right',
  name: L('Week (right)', 'Tydzień (prawa)'),
  spread: { group: 'week', position: 'right' },
  outerRailWidth: 34,
  // The week ahead; looking back happens on "My week" at the end of the week.
  outerRail: [
    railBlock(
      'if-then',
      'writing-area',
      {
        title: L('My if–then plan this week', 'Mój plan jeśli–to na ten tydzień'),
        pattern: 'lines',
      },
      fr(1),
    ),
    railBlock(
      'watch',
      'writing-area',
      {
        title: L('What to watch out for this week', 'Na co uważam w tym tygodniu'),
        pattern: 'lines',
      },
      fr(1),
    ),
  ],
  body: stack([
    dayStrip('thu', 3),
    dayStrip('fri', 4),
    dayStrip('sat', 5),
    dayStrip('sun', 6),
    // A small experiment for the week (S2); "My week" asks what it showed.
    block(
      'experiment',
      'writing-area',
      {
        title: L(
          'My small experiment: this week I will check whether…',
          'Mój mały eksperyment: w tym tygodniu sprawdzę, czy…',
        ),
        pattern: 'lines',
      },
      { height: mmH(22) },
    ),
    varies(block('legend', 'marker-legend', {}, { height: 'auto' }), {
      when: BALANCE,
      props: { markers: MARKERS_BALANCE },
    }),
  ]),
};

const dayLeft = a5(
  {
    id: 'day-left',
    name: L('Day: morning and day (left)', 'Dzień: poranek i dzień (lewa)'),
    spread: { group: 'day', position: 'left' },
    rationale: L(
      'Read left to right: the morning plan and the day on the left page, the evening reflection on the right.',
      'Czytaj od lewej do prawej: poranny plan i dzień na lewej stronie, wieczorna refleksja na prawej.',
    ),
    body: stack(
      [
        // Weekday, date and the sobriety day on one line, the quote beside it in smaller type.
        row([dateHeader({ width: fr(3) }), quoteBlock({ width: fr(2) })], { height: mmH(9) }),
        stack(
          [
            // A quick check-in (0–10, like the evening check-out), then the one action for today.
            // Without the recovery module: no craving, and a neutral commitment.
            varies(
              block(
                'checkin',
                'text',
                { text: checkin([CHECKIN.length]), variant: 'body', align: 'spread' },
                { height: 'auto' },
              ),
              { when: BALANCE_A5, props: { text: checkin([3, 2], false) } },
              { when: BALANCE, props: { text: checkin([CHECKIN.length - 1], false) } },
            ),
            // The one action for today, and who I want to be in touch with (S2, "My 24 hours").
            row(
              [
                varies(
                  block(
                    'commitment',
                    'writing-area',
                    {
                      title: L(
                        'Today I protect my sobriety by:',
                        'Dziś chronię swoją trzeźwość przez:',
                      ),
                      pattern: 'lines',
                    },
                    { width: fr(3) },
                  ),
                  {
                    when: BALANCE,
                    props: {
                      title: L('Today I take care of myself by:', 'Dziś dbam o siebie przez:'),
                    },
                  },
                ),
                block(
                  'contact',
                  'writing-area',
                  {
                    title: L('Who will I talk to today?', 'Z kim dziś porozmawiam?'),
                    pattern: 'lines',
                  },
                  { width: fr(2) },
                ),
              ],
              { height: fr(1) },
            ),
          ],
          { height: mmH(28), label: L('Morning', 'Poranek') },
        ),
        stack(
          [
            row([
              block(
                'priorities',
                'numbered-list',
                {
                  title: L('My three priorities today', 'Moje trzy najważniejsze cele na dziś'),
                  count: 3,
                  subLines: [L('How:', 'Jak:'), L('If it gets hard:', 'Gdy będzie trudno:')],
                },
                { width: fr(3) },
              ),
              without(
                block(
                  'schedule',
                  'time-grid',
                  { title: L('Plan of the day', 'Plan dnia'), from: 6, to: 22, linesPerSlot: 1 },
                  { width: fr(2) },
                ),
                DAYPLUS,
              ),
              // Day+: the rest of "My 24 hours" and something important / pleasant (S2).
              needs(
                stack(
                  [
                    block(
                      'my-24h',
                      'text',
                      { text: L('My 24 hours', 'Moje 24 godziny'), variant: 'label' },
                      { height: mmH(5) },
                    ),
                    prompt(
                      'watch-today',
                      L('Today I am especially careful about:', 'Dzisiaj szczególnie uważam na:'),
                    ),
                    prompt(
                      'if-hard',
                      L('If it gets hard, first:', 'Jeśli będzie trudno, najpierw:'),
                    ),
                    prompt(
                      'important',
                      L('One thing that matters to me', 'Jedna rzecz ważna dla mnie'),
                    ),
                    prompt(
                      'pleasant',
                      L('One thing just for pleasure', 'Jedna rzecz tylko dla przyjemności'),
                    ),
                  ],
                  { width: fr(2), gap: 2 },
                ),
                DAYPLUS,
              ),
            ]),
          ],
          { height: fr(1), label: L('Day', 'Dzień') },
        ),
        // The HALT-B module; without it the priorities and the plan of the day take the space.
        needs(
          block(
            'halt',
            'rating-matrix',
            {
              title: L(
                '{{haltName}} check (1 = not at all, 5 = very)',
                'Skala {{haltName}} (1 = wcale, 5 = bardzo)',
              ),
              // Switch to classic HALT in the designer; the title and instructions follow.
              variant: 'halt-b',
              rows: HALT_B_ROWS,
              mode: 'scale-1-5',
              noteColumn: true,
              noteLabel: L('Reason:', 'Powód:'),
              footer: L('What do I need now?', 'Czego teraz potrzebuję?'),
            },
            { height: mmH(60) },
          ),
          HALT,
        ),
      ],
      { gap: 4 },
    ),
  },
  [
    ['priorities', 'props/subLines', [L('If it gets hard:', 'Gdy będzie trudno:')]],
    ['halt', 'size/height', { mm: 50 }],
    ['quote', 'props/fallbackLines', 1],
    // The check-in on two lines of three.
    ['checkin', 'props/text', checkin([3, 3])],
    // Too narrow for the quote beside the date: the header's one line, the quote under it.
    // (Block changes above use pointers into the unpatched body, so they come first.)
    {
      op: 'replace',
      path: '/body/children/0',
      value: stack([dateHeader({ height: mmH(9) }), quoteBlock({ height: fr(1) })], {
        height: mmH(16),
        gap: 0,
      }) as JsonPatchOp['value'],
    },
    // The morning section (the body's second child) grows by the check-in's second line.
    { op: 'add', path: '/body/children/1/height', value: { mm: 33 } },
  ],
);

/** Check-out numbers written on blanks; examples fill the blanks in order. */
const CHECKOUT = L(
  `Mood ${BLANK} /10\nTension ${BLANK} /10\nCraving ${BLANK} /10\nat ${BLANK}`,
  `Nastrój ${BLANK} /10\nNapięcie ${BLANK} /10\nGłód ${BLANK} /10\no godz. ${BLANK}`,
);

/** The evening check-out without the recovery module: no craving, and energy instead. */
const CHECKOUT_BALANCE = L(
  `Mood ${BLANK} /10
Tension ${BLANK} /10
Energy ${BLANK} /10`,
  `Nastrój ${BLANK} /10
Napięcie ${BLANK} /10
Energia ${BLANK} /10`,
);

/** Triggers to tick; loneliness, boredom and tiredness are already rows of HALT-B. */
const TRIGGERS = [
  L('none today', 'nie było'),
  L('an emotion', 'emocja'),
  L('a conflict', 'konflikt'),
  L('a person', 'osoba'),
  L('a place', 'miejsce'),
  L('a memory', 'wspomnienie'),
  L('stress', 'stres'),
  L('success / euphoria', 'sukces / euforia'),
  L('money', 'pieniądze'),
  L('a social situation', 'sytuacja towarzyska'),
  L('a thought of drinking', 'myśl o piciu / użyciu'),
  L('other:', 'inne:'),
];

const PROTECTED = [
  L('talking to someone', 'rozmowa z kimś'),
  L('therapy / meeting', 'terapia / mityng'),
  L('exercise', 'ruch'),
  L('rest / sleep', 'odpoczynek / sen'),
  L('family / friends', 'rodzina / przyjaciele'),
  L('work / hobby', 'praca / hobby'),
  L('meditation / prayer', 'medytacja / modlitwa'),
  L('a change of scene', 'zmiana otoczenia'),
  L('asking for help', 'prośba o pomoc'),
  L('setting a boundary', 'postawiona granica'),
  L('avoiding a risky situation', 'unikanie ryzyka'),
  L('other:', 'inne:'),
];

const dayRight = a5(
  {
    id: 'day-right',
    name: L('Day: evening (right)', 'Dzień: wieczór (prawa)'),
    spread: { group: 'day', position: 'right' },
    rationale: L(
      'The evening check-out: a few numbers and ticks in the outer column, then what was hard, a dot grid for the reflection, a small victory, a step towards a good life, and gratitude.',
      'Wieczorny check-out: kilka liczb i zaznaczeń w zewnętrznej kolumnie, potem co było trudne, kropki na refleksję, małe zwycięstwo, krok ku dobremu życiu i wdzięczność.',
    ),
    outerRailWidth: 36,
    outerRail: [
      railBlock(
        'checkout-title',
        'text',
        { text: L('Check-out (0–10)', 'Check-out (0–10)'), variant: 'label' },
        mmH(5),
      ),
      varies(
        railBlock(
          'checkout',
          'text',
          { text: CHECKOUT, variant: 'body', align: 'columns' },
          mmH(26),
        ),
        {
          when: BALANCE,
          props: { text: CHECKOUT_BALANCE },
        },
      ),
      varies(
        railBlock(
          'trigger',
          'numbered-list',
          {
            title: L('Trigger today?', 'Czy pojawił się wyzwalacz?'),
            marker: 'checkbox',
            items: TRIGGERS,
            count: TRIGGERS.length,
            lineHeight: 5,
          },
          fr(1),
        ),
        {
          when: BALANCE,
          props: {
            title: L('What weighed on me today?', 'Co mnie dziś obciążało?'),
            items: STRAIN_BALANCE,
            count: STRAIN_BALANCE.length,
          },
        },
      ),
      railBlock(
        'trigger-response',
        'writing-area',
        { title: L('What did I do?', 'Co {g:zrobiłem|zrobiłam}?'), pattern: 'lines' },
        mmH(20),
      ),
      varies(
        railBlock(
          'protected',
          'numbered-list',
          {
            title: L('What protected me today?', 'Co mnie dzisiaj chroniło?'),
            marker: 'checkbox',
            items: PROTECTED,
            count: PROTECTED.length,
            lineHeight: 5,
          },
          fr(1),
        ),
        {
          when: BALANCE,
          props: {
            title: L('What helped me today?', 'Co mi dziś pomogło?'),
            items: HELPED_BALANCE,
            count: HELPED_BALANCE.length,
          },
        },
      ),
    ],
    body: stack(
      [
        varies(
          block(
            'threat',
            'writing-area',
            {
              title: L(
                'What was hard today? What threatened my sobriety?',
                'Co dzisiaj było trudne? Co zagroziło mojej trzeźwości?',
              ),
              pattern: 'lines',
            },
            { height: mmH(26) },
          ),
          { when: BALANCE, props: { title: L('What was hard today?', 'Co dzisiaj było trudne?') } },
        ),
        block(
          'reflection',
          'writing-area',
          { title: L('Reflections on the day', 'Refleksje z dnia'), pattern: 'dots', pitch: 5 },
          { height: fr(1) },
        ),
        block(
          'victory',
          'writing-area',
          {
            title: L(
              'My small victory: what did I do well today, even something small?',
              'Moje małe zwycięstwo: co {g:zrobiłem|zrobiłam} dziś dobrze, nawet jeśli to drobiazg?',
            ),
            pattern: 'lines',
          },
          { height: mmH(19) },
        ),
        block(
          'good-life',
          'writing-area',
          {
            title: L(
              'A good life: what did I do today for the life I want to live?',
              'Dobre życie: co {g:zrobiłem|zrobiłam} dziś dla życia, które chcę prowadzić?',
            ),
            pattern: 'lines',
          },
          { height: mmH(19) },
        ),
        block(
          'gratitude',
          'numbered-list',
          {
            title: L('What am I grateful for today?', 'Za co jestem dziś {g:wdzięczny|wdzięczna}?'),
            count: 3,
          },
          { height: mmH(28) },
        ),
        block(
          'tomorrow',
          'writing-area',
          { title: L('Worth remembering tomorrow', 'Jutro warto pamiętać'), pattern: 'lines' },
          { height: mmH(14) },
        ),
      ],
      { gap: 4, label: L('Evening', 'Wieczór') },
    ),
  },
  [
    ['threat', 'size/height', { mm: 19 }],
    ['victory', 'size/height', { mm: 15 }],
    ['good-life', 'size/height', { mm: 15 }],
    ['gratitude', 'size/height', { mm: 24 }],
    ['tomorrow', 'size/height', { mm: 13 }],
    // A5 is too narrow for the outer column: the check-out moves into the page as one line, with
    // a line for the trigger; the tick lists are left out.
    { op: 'add', path: '/outerRailWidth', value: 0 },
    { op: 'remove', path: '/outerRail' },
    {
      op: 'add',
      path: '/body/children/1',
      value: {
        kind: 'block',
        block: {
          id: 'checkout-line',
          type: 'text',
          props: {
            text: L(
              `Check-out: mood ${BLANK} /10 · tension ${BLANK} /10 · craving ${BLANK} /10`,
              `Check-out: nastrój ${BLANK} /10 · napięcie ${BLANK} /10 · głód ${BLANK} /10`,
            ),
            variant: 'caption',
          },
          size: { height: { mm: 6 } },
          variants: [
            {
              when: BALANCE,
              props: {
                text: L(
                  `Check-out: mood ${BLANK} /10 · tension ${BLANK} /10 · energy ${BLANK} /10`,
                  `Check-out: nastrój ${BLANK} /10 · napięcie ${BLANK} /10 · energia ${BLANK} /10`,
                ),
              },
            },
          ],
        },
      },
    },
    {
      op: 'add',
      path: '/body/children/2',
      value: {
        kind: 'block',
        block: {
          id: 'trigger-line',
          type: 'writing-area',
          props: {
            title: L(
              'Trigger today? What did I do? What protected me?',
              'Wyzwalacz? Co {g:zrobiłem|zrobiłam}? Co mnie chroniło?',
            ),
            pattern: 'lines',
          },
          size: { height: { mm: 16 } },
          variants: [
            { when: BALANCE, props: { title: L('What helped me today?', 'Co mi dziś pomogło?') } },
          ],
        },
      },
    },
  ],
);

const writeLines = (id: string, title: ReturnType<typeof L>, height: Length) =>
  block(id, 'writing-area', { title, pattern: 'lines' }, { height });

/** The review's own tick lists are the evening lists, so a week's ticks can simply be counted. */
const WEEK_TRIGGERS = TRIGGERS.slice(1);

const weekNumbers = L(
  `Mood, on average ${BLANK} /10\nTension, on average ${BLANK} /10\nStrongest craving ${BLANK} /10\nDays with craving ≥ 5 ${BLANK} /7\nDays with support ${BLANK} /7\nDays with exercise ${BLANK} /7\nDays with therapy / a meeting ${BLANK} /7`,
  `Nastrój, średnio ${BLANK} /10\nNapięcie, średnio ${BLANK} /10\nNajsilniejszy głód ${BLANK} /10\nDni z głodem ≥ 5 ${BLANK} /7\nDni ze wsparciem ${BLANK} /7\nDni z ruchem ${BLANK} /7\nDni z terapią / mityngiem ${BLANK} /7`,
);

/** The week in numbers without the recovery module: no craving, and days of rest instead. */
const weekNumbersBalance = L(
  `Mood, on average ${BLANK} /10\nTension, on average ${BLANK} /10\nDays with support ${BLANK} /7\nDays with exercise ${BLANK} /7\nDays with rest ${BLANK} /7`,
  `Nastrój, średnio ${BLANK} /10\nNapięcie, średnio ${BLANK} /10\nDni ze wsparciem ${BLANK} /7\nDni z ruchem ${BLANK} /7\nDni z odpoczynkiem ${BLANK} /7`,
);

const ifThen = (height: Length) =>
  writeLines('if-then', L('If …, then I will …', 'Jeśli …, to zrobię …'), height);

const oneSentence = writeLines(
  'one-sentence',
  L('One sentence about this week', 'Jedno zdanie o tym tygodniu'),
  mmH(19),
);

const reviewHeader = [
  heading('heading', L('My week', 'Mój tydzień')),
  caption(
    'how',
    L(
      'Week {{weekRange}}. Look back over your evening pages and sum up; two or three minutes are enough.',
      'Tydzień {{weekRange}}. Przejrzyj strony wieczorne i podsumuj; wystarczą dwie–trzy minuty.',
    ),
  ),
];

/** A5: the quick version, with lines to write on instead of tick lists. */
const weekReviewA5: LayoutNode = stack(
  [
    ...reviewHeader,
    varies(
      block(
        'numbers-a5',
        'text',
        {
          text: L(
            `Mood ${BLANK} /10 · tension ${BLANK} /10\nStrongest craving ${BLANK} /10 · days with craving ≥ 5 ${BLANK} /7`,
            `Nastrój ${BLANK} /10 · napięcie ${BLANK} /10\nNajsilniejszy głód ${BLANK} /10 · dni z głodem ≥ 5 ${BLANK} /7`,
          ),
          variant: 'body',
        },
        { height: mmH(12) },
      ),
      {
        when: BALANCE,
        props: {
          text: L(
            `Mood ${BLANK} /10 · tension ${BLANK} /10\nDays with exercise ${BLANK} /7 · days with rest ${BLANK} /7`,
            `Nastrój ${BLANK} /10 · napięcie ${BLANK} /10\nDni z ruchem ${BLANK} /7 · dni z odpoczynkiem ${BLANK} /7`,
          ),
        },
      },
    ),
    needs(
      writeLines(
        'halt-quick',
        L('Most often high in {{haltName}}:', 'Najczęściej wysoko w {{haltName}}:'),
        fr(1),
      ),
      HALT,
    ),
    varies(
      writeLines('trigger-quick', L('Most common trigger:', 'Najczęstszy wyzwalacz:'), fr(1)),
      {
        when: BALANCE,
        props: { title: L('What weighed on me most:', 'Co mnie najbardziej obciążało:') },
      },
    ),
    writeLines('helped-quick', L('What helped most:', 'Co pomogło najbardziej:'), fr(1)),
    writeLines('win-quick', L('My biggest win:', 'Moje największe zwycięstwo:'), fr(1)),
    writeLines('pattern', L('A pattern I notice:', 'Wzorzec, który zauważam:'), fr(1)),
    writeLines(
      'experiment',
      L('What did my experiment show?', 'Co pokazał mój eksperyment?'),
      fr(1),
    ),
    writeLines('continue', L('Next week I want to:', 'W przyszłym tygodniu chcę:'), fr(1)),
    ifThen(fr(1)),
    oneSentence,
  ],
  { gap: 3 },
);

const weekReview = a5(
  {
    id: 'week-review',
    name: L('My week', 'Mój tydzień'),
    spread: { group: 'week-end', position: 'left' },
    rationale: L(
      'The end of the week in two or three minutes: it adds up what the evening pages already hold (numbers, HALT, triggers, what protected me), then wins, a pattern and a plan for next week.',
      'Koniec tygodnia w dwie–trzy minuty: zbiera to, co już jest na stronach wieczornych (liczby, HALT, wyzwalacze, co mnie chroniło), potem zwycięstwa, wzorzec i plan na kolejny tydzień.',
    ),
    body: stack(
      [
        ...reviewHeader,
        row(
          [
            stack(
              [
                block(
                  'numbers-title',
                  'text',
                  { text: L('The week in numbers', 'Tydzień w liczbach'), variant: 'label' },
                  { height: mmH(5) },
                ),
                varies(
                  block(
                    'numbers',
                    'text',
                    { text: weekNumbers, variant: 'body' },
                    { height: mmH(40) },
                  ),
                  { when: BALANCE, props: { text: weekNumbersBalance } },
                ),
                needs(
                  block(
                    'halt',
                    'rating-matrix',
                    {
                      title: L('{{haltName}}: most often at 4–5', '{{haltName}}: najczęściej 4–5'),
                      variant: 'auto',
                      rows: HALT_B_ROWS,
                      mode: 'checkbox',
                      noteColumn: false,
                    },
                    { height: mmH(42) },
                  ),
                  HALT,
                ),
                needs(
                  writeLines(
                    'halt-reason',
                    L('Most common reason:', 'Najczęstszy powód:'),
                    mmH(13),
                  ),
                  HALT,
                ),
                varies(
                  block(
                    'triggers',
                    'numbered-list',
                    {
                      title: L('Triggers this week', 'Wyzwalacze tygodnia'),
                      marker: 'checkbox',
                      items: WEEK_TRIGGERS,
                      count: WEEK_TRIGGERS.length,
                      lineHeight: 5,
                    },
                    { height: fr(1) },
                  ),
                  {
                    when: BALANCE,
                    props: {
                      title: L('What weighed on me this week', 'Co mnie obciążało w tym tygodniu'),
                      items: STRAIN_BALANCE.slice(1),
                      count: STRAIN_BALANCE.length - 1,
                    },
                  },
                ),
                writeLines(
                  'hardest',
                  L('The hardest moment of the week:', 'Najtrudniejszy moment tygodnia:'),
                  mmH(13),
                ),
                block(
                  'time-of-day',
                  'text',
                  {
                    text: L(
                      'Most often (circle): morning · day · afternoon · evening · night',
                      'Najczęstsza pora (zakreśl): rano · dzień · popołudnie · wieczór · noc',
                    ),
                    variant: 'caption',
                  },
                  { height: mmH(6) },
                ),
              ],
              { gap: 3 },
            ),
            stack(
              [
                varies(
                  block(
                    'protected',
                    'numbered-list',
                    {
                      title: L('What protected me most', 'Co mnie najbardziej chroniło'),
                      marker: 'checkbox',
                      items: PROTECTED,
                      count: PROTECTED.length,
                      lineHeight: 5,
                    },
                    { height: fr(1) },
                  ),
                  {
                    when: BALANCE,
                    props: {
                      title: L('What helped me most', 'Co mi najbardziej pomagało'),
                      items: HELPED_BALANCE,
                      count: HELPED_BALANCE.length,
                    },
                  },
                ),
                writeLines(
                  'most-effective',
                  L('The most effective thing:', 'Najskuteczniejsza rzecz:'),
                  mmH(13),
                ),
                block(
                  'wins',
                  'numbered-list',
                  { title: L('My 3 wins this week', 'Moje 3 zwycięstwa tygodnia'), count: 3 },
                  { height: mmH(30) },
                ),
                writeLines(
                  'pattern',
                  L('I noticed that…', '{g:Zauważyłem|Zauważyłam}, że…'),
                  mmH(20),
                ),
                writeLines(
                  'experiment',
                  L('What did my experiment show?', 'Co pokazał mój eksperyment?'),
                  mmH(13),
                ),
                writeLines(
                  'continue',
                  L('Next week I want to keep:', 'W przyszłym tygodniu chcę kontynuować:'),
                  mmH(13),
                ),
                writeLines(
                  'differently',
                  L('One thing I will do differently:', 'Jedna rzecz, którą zrobię inaczej:'),
                  mmH(13),
                ),
                ifThen(mmH(13)),
              ],
              { gap: 3 },
            ),
          ],
          { gap: 6, height: fr(1) },
        ),
        oneSentence,
      ],
      { gap: 4 },
    ),
  },
  [{ op: 'add', path: '/body', value: weekReviewA5 as JsonPatchOp['value'] }],
);

const situation: PageTemplate = {
  id: 'situation',
  name: L('Situation analysis', 'Analiza sytuacji'),
  // With "My week" on the left, the end of the week is one spread; without it, a filler page
  // comes first.
  spread: { group: 'week-end', position: 'right' },
  rationale: L(
    'Optional, once a week or after a hard day: a thought that raised the risk and an answer to it, then one situation step by step (what happened, thought, feeling, action, next time).',
    'Opcjonalna, raz w tygodniu albo po trudnym dniu: myśl, która zwiększała ryzyko, i odpowiedź na nią, potem jedna sytuacja krok po kroku (wydarzenie, myśl, uczucie, działanie, następnym razem).',
  ),
  body: stack(
    [
      heading('heading', L('Situation analysis', 'Analiza sytuacji')),
      caption(
        'how',
        L(
          'Week {{weekRange}}. One situation is enough; short answers are fine.',
          'Tydzień {{weekRange}}. Wystarczy jedna sytuacja i krótkie odpowiedzi.',
        ),
      ),
      stack(
        [
          varies(
            block(
              'risky-thought',
              'writing-area',
              {
                title: L(
                  'Did I notice a thought that raised the risk? What was it?',
                  'Czy {g:zauważyłem|zauważyłam} myśl, która zwiększała ryzyko? Jaka to była myśl?',
                ),
                pattern: 'lines',
              },
              { height: fr(1) },
            ),
            {
              when: BALANCE,
              props: {
                title: L(
                  'Did I notice a thought that did not help me? What was it?',
                  'Czy {g:zauważyłem|zauważyłam} myśl, która mi nie pomagała? Jaka to była myśl?',
                ),
              },
            },
          ),
          block(
            'thought-answer',
            'writing-area',
            {
              title: L('What can I say back to this thought?', 'Co mogę odpowiedzieć tej myśli?'),
              pattern: 'lines',
            },
            { height: fr(1) },
          ),
        ],
        { height: fr(2), label: L('A thought', 'Myśl'), gap: 3 },
      ),
      stack(
        [
          block(
            'happened',
            'writing-area',
            { title: L('What happened?', 'Co się wydarzyło?'), pattern: 'lines' },
            { height: fr(1) },
          ),
          block(
            'thought',
            'writing-area',
            { title: L('What did I think?', 'Co {g:pomyślałem|pomyślałam}?'), pattern: 'lines' },
            { height: fr(1) },
          ),
          block(
            'felt',
            'writing-area',
            { title: L('What did I feel?', 'Co {g:poczułem|poczułam}?'), pattern: 'lines' },
            { height: fr(1) },
          ),
          block(
            'did',
            'writing-area',
            { title: L('What did I do?', 'Co {g:zrobiłem|zrobiłam}?'), pattern: 'lines' },
            { height: fr(1) },
          ),
          block(
            'next-time',
            'writing-area',
            {
              title: L('What could help me next time?', 'Co mogłoby mi pomóc następnym razem?'),
              pattern: 'lines',
            },
            { height: fr(1) },
          ),
        ],
        { height: fr(5), label: L('One situation', 'Jedna sytuacja'), gap: 3 },
      ),
    ],
    { gap: 5 },
  ),
};

// A5: larger labels, so they stay readable; the wheel is a little smaller for it.
const wheel = a5(
  {
    id: 'wheel-of-life',
    name: L('Wheel of Life', 'Koło Życia'),
    spread: { group: 'month-end', position: 'left' },
    rationale: L(
      'Coloured by hand each month; seen month after month, a wheel that becomes rounder is tangible evidence of change.',
      'Kolorowane ręcznie co miesiąc; koło, które z miesiąca na miesiąc staje się równiejsze, jest namacalnym dowodem zmiany.',
    ),
    body: stack([
      heading('heading', L('Wheel of Life · {{monthName}}', 'Koło Życia · {{monthName}}')),
      caption(
        'how',
        L(
          'Colour each area from the centre (1) out to how satisfied you feel (10).',
          'Pokoloruj każdy obszar od środka (1) do poziomu, na jakim oceniasz swoje zadowolenie (10).',
        ),
      ),
      // Without the recovery module, "Recovery" becomes "Meaning and spirituality".
      varies(block('wheel', 'radial-scale', { segments: WHEEL }, { height: fr(1) }), {
        when: BALANCE,
        props: { segments: WHEEL_BALANCE },
      }),
      block(
        'notice',
        'writing-area',
        { title: L('What do I notice?', 'Co zauważam?'), pattern: 'lines' },
        { height: mmH(28) },
      ),
      block(
        'improvement',
        'writing-area',
        {
          title: L(
            'Where was there even a small improvement?',
            'Gdzie nastąpiła nawet mała poprawa?',
          ),
          pattern: 'lines',
        },
        { height: mmH(28) },
      ),
    ]),
  },
  [
    ['wheel', 'props/labelSize', 8],
    ['notice', 'size/height', { mm: 22 }],
    ['improvement', 'size/height', { mm: 22 }],
  ],
);

/** Weekly numbers copied from each "My week" into one table. */
const WEEK_ROWS = ['1', '2', '3', '4', '5'].map((n) => L(n, n));
const WEEKS_COLUMNS = [
  L('Mood, avg.', 'Nastrój, śr.'),
  L('Tension, avg.', 'Napięcie, śr.'),
  L('Strongest craving', 'Najsilniejszy głód'),
  L('Days with support', 'Dni ze wsparciem'),
];
const WEEKS_COLUMNS_BALANCE = [
  ...WEEKS_COLUMNS.slice(0, 2),
  L('Days with exercise', 'Dni z ruchem'),
  L('Days with rest', 'Dni z odpoczynkiem'),
];

// The month end (S2): the wheel, then what the month showed, my patterns, and what next.
const review = a5(
  {
    id: 'monthly-review',
    name: L('What did this month show me?', 'Co pokazał mi miesiąc?'),
    spread: { group: 'month-end', position: 'right' },
    rationale: L(
      'The month rolls up the weekly reviews: their numbers go into one table, so the month can be read at a glance before naming what helped and what was hard.',
      'Miesiąc zbiera tygodniowe podsumowania: ich liczby trafiają do jednej tabeli, więc miesiąc widać na pierwszy rzut oka, zanim nazwiesz, co pomogło i co było trudne.',
    ),
    body: stack([
      heading('heading', L('What did this month show me?', 'Co pokazał mi miesiąc?')),
      caption(
        'how',
        L(
          'Copy the numbers from each "My week", then look at the month as a whole.',
          'Przepisz liczby z każdego „Mojego tygodnia”, potem spójrz na cały miesiąc.',
        ),
      ),
      varies(
        block(
          'weeks',
          'table',
          {
            title: L('My weeks', 'Moje tygodnie'),
            rowHeader: L('Week', 'Tydzień'),
            rows: WEEK_ROWS,
            columns: WEEKS_COLUMNS,
            ruling: 'grid',
          },
          { height: mmH(52) },
        ),
        { when: BALANCE, props: { columns: WEEKS_COLUMNS_BALANCE } },
      ),
      prompt('helped', L('What helped me most:', 'Najbardziej pomogło mi:')),
      prompt('hardest', L('What was hardest:', 'Najtrudniejsze było:')),
      varies(
        prompt('trigger', L('The most common trigger:', 'Najczęściej pojawiający się wyzwalacz:')),
        {
          when: BALANCE,
          props: { title: L('What weighed on me most:', 'Co mnie najbardziej obciążało:') },
        },
      ),
      prompt('strategy', L('The most effective strategy:', 'Najskuteczniejsza strategia:')),
      prompt(
        'learned',
        L(
          'The most important thing I learned about myself:',
          'Najważniejsza rzecz, której {g:dowiedziałem|dowiedziałam} się o sobie:',
        ),
      ),
    ]),
  },
  [['weeks', 'size/height', { mm: 44 }]],
);

const WHEN_HARD = [
  L('morning', 'rano'),
  L('midday', 'południe'),
  L('afternoon', 'popołudnie'),
  L('evening', 'wieczór'),
  L('night', 'noc'),
  L('weekend', 'weekend'),
  L('workdays', 'dni pracy'),
  L('days off', 'dni wolne'),
];

/** States before a hard moment: HALT-B, then stress, conflict and overload. */
const STATES = [
  L('hunger', 'głód fizyczny'),
  L('anger', 'złość'),
  L('loneliness', 'samotność'),
  L('tiredness', 'zmęczenie'),
  L('boredom', 'nuda'),
  L('stress', 'stres'),
  L('a conflict', 'konflikt'),
  L('overload', 'przeciążenie'),
];

const monthPatterns = a5(
  {
    id: 'month-patterns',
    name: L('My patterns', 'Moje wzorce'),
    spread: { group: 'month-next', position: 'left' },
    body: stack([
      heading('heading', L('My patterns', 'Moje wzorce')),
      caption(
        'how',
        L(
          'Tick what came up most often this month; the evening pages and "My week" will remind you.',
          'Zaznacz, co pojawiało się najczęściej w tym miesiącu; przypomną Ci to strony wieczorne i „Mój tydzień”.',
        ),
      ),
      row(
        [
          ticks(
            'when-hard',
            L('When was it hard most often?', 'Kiedy najczęściej było trudno?'),
            WHEN_HARD,
            fr(1),
          ),
          varies(
            ticks(
              'states',
              L(
                'Most common states before the risk rose',
                'Najczęstsze stany przed wzrostem ryzyka',
              ),
              STATES,
              fr(1),
            ),
            {
              when: BALANCE,
              props: {
                title: L(
                  'Most common states before a worse day',
                  'Najczęstsze stany przed gorszym dniem',
                ),
              },
            },
          ),
        ],
        { height: mmH(58), gap: 6 },
      ),
      varies(
        writeLines(
          'warning',
          L(
            'What warning signs did I notice?',
            'Jakie sygnały ostrzegawcze {g:zauważyłem|zauważyłam}?',
          ),
          mmH(28),
        ),
        { when: BALANCE, props: { title: L('What did not serve me?', 'Co mi nie służyło?') } },
      ),
      block(
        'helped-most',
        'numbered-list',
        { title: L('What helped most often?', 'Co najczęściej pomagało?'), count: 3 },
        { height: mmH(30) },
      ),
      prompt('insight', L('What follows from this for me?', 'Co z tego dla mnie wynika?')),
    ]),
  },
  [
    ['warning', 'size/height', { mm: 22 }],
    ['helped-most', 'size/height', { mm: 26 }],
  ],
);

const monthNext: PageTemplate = {
  id: 'month-next',
  name: L('Looking ahead', 'Dalej'),
  spread: { group: 'month-next', position: 'right' },
  body: stack([
    heading('heading', L('Looking ahead', 'Dalej')),
    prompt('continue', L('I want to continue:', 'Chcę kontynuować:')),
    prompt('limit', L('I want to cut down on:', 'Chcę ograniczyć:')),
    prompt('try', L('I want to try:', 'Chcę spróbować:')),
    prompt('attention', L('Needs more attention:', 'Więcej uwagi wymaga:')),
    block(
      'next-word',
      'writing-area',
      {
        title: L('My word for next month', 'Moje słowo na kolejny miesiąc'),
        pattern: 'lines',
        pitch: 9,
        framed: true,
      },
      { height: mmH(24) },
    ),
  ]),
};

const notes: PageTemplate = {
  id: 'notes',
  name: L('Notes (5 mm dot grid)', 'Notatki (kropki 5 mm)'),
  body: stack([block('notes', 'writing-area', { pattern: 'dots', pitch: 5 }, { height: fr(1) })]),
};

// ---------------------------------------------------------------------------------------------
// Crisis and relapse prevention

const E = (en: string, pl: string) => L(en, pl);

const warningLeft: PageTemplate = {
  id: 'warning-signs-left',
  name: L('Warning signs (left)', 'Sygnały ostrzegawcze (lewa)'),
  spread: { group: 'warning-signs', position: 'left' },
  rationale: L(
    'Relapse starts long before the first drink or use. Four areas help the patient notice it early.',
    'Nawrót zaczyna się długo przed sięgnięciem po substancję. Cztery obszary pomagają zauważyć go wcześnie.',
  ),
  body: stack([
    heading('heading', L('My warning signs', 'Moje sygnały ostrzegawcze')),
    caption(
      'how',
      L(
        'Tick the signs you know from your own experience, and add your own in your words.',
        'Zaznacz sygnały, które znasz z własnego doświadczenia, i dopisz własne, swoimi słowami.',
      ),
      10,
    ),
    block(
      'grid',
      'category-grid',
      {
        columns: 1,
        examplesAs: 'ticks',
        cells: [
          {
            title: L('Body', 'Ciało'),
            examples: [
              E('insomnia', 'bezsenność'),
              E('muscle tension', 'napięcie mięśni'),
              E('jaw clenching', 'zaciskanie szczęki'),
              E('exhaustion', 'wyczerpanie'),
              E('headaches', 'bóle głowy'),
              E('skipping meals', 'pomijanie posiłków'),
            ],
          },
          {
            title: L('Thoughts', 'Myśli'),
            examples: [
              E('“One time will not hurt.”', '„Jeden raz nie zaszkodzi.”'),
              E('“I can control it now.”', '„Teraz już nad tym panuję.”'),
              E('“I do not need meetings anymore.”', '„Nie potrzebuję już mityngów.”'),
              E('“I deserve it.”', '„Należy mi się.”'),
            ],
          },
        ],
      },
      { height: fr(1) },
    ),
  ]),
};

const warningRight: PageTemplate = {
  id: 'warning-signs-right',
  name: L('Warning signs (right)', 'Sygnały ostrzegawcze (prawa)'),
  spread: { group: 'warning-signs', position: 'right' },
  body: stack([
    block(
      'grid',
      'category-grid',
      {
        columns: 1,
        examplesAs: 'ticks',
        cells: [
          {
            title: L('Emotions', 'Emocje'),
            examples: [
              E('frustration', 'frustracja'),
              E('self-pity', 'użalanie się nad sobą'),
              E('anger', 'złość'),
              E('hopelessness', 'beznadzieja'),
              E('anxiety', 'lęk'),
              E('boredom', 'nuda'),
            ],
          },
          {
            title: L('Behaviours', 'Zachowania'),
            examples: [
              E('isolation', 'izolowanie się'),
              E('avoiding meetings', 'unikanie mityngów'),
              E('lying', 'kłamstwa'),
              E('abandoning routines', 'porzucanie codziennych rutyn'),
              E('irritability', 'drażliwość'),
              E('romanticising using', 'idealizowanie picia / używania'),
            ],
          },
        ],
      },
      { height: fr(1) },
    ),
    // My own threshold, then three steps: an early, concrete response.
    block(
      'threshold',
      'text',
      {
        text: L(
          `When I notice ${NUM} of these signs, I will:`,
          `Gdy zauważę ${NUM} z tych sygnałów, robię:`,
        ),
        variant: 'subheading',
      },
      { height: mmH(8) },
    ),
    block('three-signs', 'numbered-list', { count: 3 }, { height: mmH(28) }),
  ]),
};

const gainsLosses: PageTemplate = {
  id: 'gains-losses',
  name: L('Gains and losses', 'Bilans zysków i strat'),
  rationale: L(
    'Headings can be changed for programmes that use a different model; acknowledging what the substance gave helps find healthier replacements.',
    'Nagłówki można zmienić dla programów opartych na innym modelu; uznanie, co dawała substancja, pomaga znaleźć zdrowsze zamienniki.',
  ),
  body: stack([
    heading('heading', L('Balance of gains and losses', 'Bilans zysków i strat')),
    block(
      'quadrants',
      'category-grid',
      {
        columns: 2,
        cells: [
          { title: L('Benefits of drinking / using', 'Zyski z picia / używania'), examples: [] },
          {
            title: L('Costs of drinking / using', 'Straty wynikające z picia / używania'),
            examples: [],
          },
          { title: L('Benefits of sobriety', 'Zyski z trzeźwości'), examples: [] },
          { title: L('Challenges of sobriety', 'Trudności związane z trzeźwością'), examples: [] },
        ],
      },
      { height: fr(1) },
    ),
  ]),
};

const supportNetwork: PageTemplate = {
  id: 'support-network',
  name: L('Support network', 'Sieć wsparcia'),
  body: stack([
    heading('heading', L('My support network', 'Moja sieć wsparcia')),
    block(
      'contacts',
      'contact-table',
      {
        roles: [
          L('Sponsor', 'Sponsor'),
          L('Therapist', 'Terapeuta / terapeutka'),
          L('Friend', 'Przyjaciel / przyjaciółka'),
          L('Family member', 'Ktoś z rodziny'),
          L('Doctor', 'Lekarz / lekarka'),
          L('Emergency contact', 'Kontakt alarmowy'),
        ],
        fields: [
          L('Name', 'Imię i nazwisko'),
          L('Phone', 'Telefon'),
          L('When I can call', 'Kiedy mogę zadzwonić'),
          L('Notes', 'Uwagi'),
        ],
      },
      { height: fr(1) },
    ),
    block(
      'isolate',
      'writing-area',
      {
        title: L(
          'When I feel like isolating, first I contact:',
          'Gdy mam ochotę się izolować, najpierw kontaktuję się z:',
        ),
        pattern: 'lines',
        framed: true,
      },
      { height: mmH(20) },
    ),
  ]),
};

const sos: PageTemplate = {
  id: 'sos',
  name: L('My plan for a hard moment', 'Mój plan na trudny moment'),
  rationale: L(
    'First in the crisis section, so it is found in a hurry: three steps for the next few minutes (stop, do not stay alone, change the situation), with the SOBER pause.',
    'Na początku sekcji kryzysowej, żeby znaleźć go w pośpiechu: trzy kroki na najbliższe minuty (zatrzymaj się, nie zostawaj sam, zmień sytuację), z pauzą SOBER.',
  ),
  body: stack(
    [
      heading('heading', L('My plan for a hard moment', 'Mój plan na trudny moment')),
      caption(
        'how',
        L(
          'When tension or craving is strong, I do not have to solve my whole life. First I take care of the next few minutes.',
          'Kiedy jestem w silnym napięciu lub głodzie, nie muszę rozwiązywać całego życia. Najpierw mam zadbać o najbliższe minuty.',
        ),
        10,
      ),
      stack(
        [
          row([
            ticks(
              'feelings',
              L('What is happening to me?', 'Co się ze mną dzieje?'),
              [
                L('craving', 'głód'),
                L('tension', 'napięcie'),
                L('anger', 'złość'),
                L('loneliness', 'samotność'),
                L('tiredness', 'zmęczenie'),
                L('boredom', 'nuda'),
                L('fear', 'lęk'),
                L('hopelessness', 'beznadzieja'),
                L('other:', 'inne:'),
              ],
              fr(1),
            ),
            // SOBER, from mindfulness-based relapse prevention: a pause between urge and action.
            block(
              'sober',
              'numbered-list',
              {
                title: L('SOBER: a pause before I act', 'SOBER: pauza, zanim zareaguję'),
                marker: 'none',
                items: [
                  L('S — Stop', 'S — Stop: zatrzymuję się'),
                  L('O — Observe body, thoughts, feelings', 'O — zauważam ciało, myśli, emocje'),
                  L('B — Breathe', 'B — oddycham'),
                  L('E — Expand my attention', 'E — poszerzam uwagę'),
                  L('R — Respond: choose what to do', 'R — świadomie wybieram, co zrobię'),
                ],
                count: 5,
                lineHeight: 6,
              },
              { height: fr(1) },
            ),
          ]),
        ],
        { height: mmH(66), label: L('Step 1 — I stop', 'Krok 1 — Zatrzymuję się') },
      ),
      stack(
        [
          block(
            'contacts',
            'contact-table',
            {
              roles: [L('1.', '1.'), L('2.', '2.'), L('3.', '3.')],
              fields: [L('Name', 'Imię'), L('Phone', 'Telefon')],
            },
            { height: fr(1) },
          ),
        ],
        {
          height: mmH(58),
          label: L(
            'Step 2 — I do not stay alone with it',
            'Krok 2 — Nie zostaję z tym {g:sam|sama}',
          ),
        },
      ),
      stack(
        [
          ticks(
            'change',
            L('I can:', 'Mogę:'),
            [
              L('leave the place', 'wyjść z miejsca'),
              L('remove access to alcohol / substances', 'usunąć dostęp do alkoholu / substancji'),
              L('call someone', 'zadzwonić'),
              L('go somewhere safe', 'pójść w bezpieczne miejsce'),
              L('go to a meeting / group', 'pójść na mityng / grupę'),
              L('stay with someone', 'zostać z kimś'),
              L('other:', 'inne:'),
            ],
            mmH(46),
          ),
          writeLines(
            'places',
            L(
              'Safe places and meetings I can go to:',
              'Bezpieczne miejsca i mityngi, do których mogę pójść:',
            ),
            fr(1),
          ),
        ],
        {
          height: fr(1),
          label: L('Step 3 — I change the situation', 'Krok 3 — Zmieniam sytuację'),
        },
      ),
    ],
    { gap: 4 },
  ),
};

/**
 * A5: one line per contact, shorter steps, and no safe places line, so the whole plan fits on
 * one page. Body children: 0 heading, 1 caption, 2–4 steps 1–3.
 */
const sosPage = a5(sos, [
  ['contacts', 'props/fields', [L('Name and phone', 'Imię i telefon')]],
  { op: 'add', path: '/body/children/2/height', value: { mm: 61 } },
  { op: 'add', path: '/body/children/3/height', value: { mm: 38 } },
  { op: 'remove', path: '/body/children/4/children/1' },
]);

const cravingThresholds: PageTemplate = {
  id: 'craving-thresholds',
  name: L('How I respond to craving', 'Jak reaguję na głód'),
  rationale: L(
    'A personal alarm threshold: the stronger the craving, the less is decided alone. Written in a calm moment, used in a hard one.',
    'Osobisty próg alarmowy: im silniejszy głód, tym mniej decyzji podejmuję sam. Pisany w spokojnej chwili, używany w trudnej.',
  ),
  body: stack(
    [
      heading('heading', L('How do I respond to craving?', 'Jak reaguję na głód?')),
      caption(
        'how',
        L(
          'My alarm threshold. Fill it in on a calm day, ideally with your therapist or sponsor.',
          'Mój próg alarmowy. Wypełnij go w spokojny dzień, najlepiej z terapeutą lub sponsorem.',
        ),
      ),
      writeLines(
        'low',
        L('0–3 · On my own I can use:', '0–3 · Mogę samodzielnie zastosować:'),
        fr(1),
      ),
      writeLines(
        'mid',
        L('4–6 · I contact … and I do:', '4–6 · Kontaktuję się z … i robię:'),
        fr(1),
      ),
      writeLines(
        'high',
        L(
          '7–8 · I make no decision alone. Who and where:',
          '7–8 · Nie podejmuję decyzji {g:sam|sama}. Kontakt i miejsce:',
        ),
        fr(1),
      ),
      writeLines(
        'top',
        L(
          '9–10 · I do not stay alone. I contact … and go to:',
          '9–10 · Nie zostaję {g:sam|sama}. Kontaktuję się z … i idę do:',
        ),
        fr(1),
      ),
      block(
        'negotiate',
        'text',
        {
          text: L(
            `When I start bargaining with myself: I make no decision for ${NUM} minutes, and first I call ${BLANK}.`,
            `Gdy zaczynam negocjować {g:sam|sama} ze sobą: nie podejmuję decyzji przez ${NUM} minut, najpierw dzwonię do ${BLANK}.`,
          ),
          variant: 'subheading',
        },
        { height: mmH(16) },
      ),
    ],
    { gap: 4 },
  ),
};

const emergencyList: PageTemplate = {
  id: 'emergency-list',
  name: L('When I do not know what to do', 'Kiedy nie wiem, co zrobić'),
  rationale: L(
    'A ready list for the moment when nothing comes to mind, and the craving wave (urge surfing): a craving rises, peaks and falls.',
    'Gotowa lista na chwilę, gdy nic nie przychodzi do głowy, oraz fala głodu (urge surfing): głód narasta, osiąga szczyt i opada.',
  ),
  body: stack(
    [
      heading('heading', L('When I do not know what to do', 'Kiedy nie wiem, co zrobić')),
      caption('how', L('First I choose one thing.', 'Najpierw wybieram jedną rzecz.')),
      row(
        [
          ticks(
            'first',
            undefined,
            [
              L('water / a meal', 'woda / posiłek'),
              L('a shower', 'prysznic'),
              L('a walk / exercise', 'spacer / ruch'),
              L('a change of place', 'zmiana miejsca'),
              L('a phone call', 'telefon'),
              L('meeting someone', 'spotkanie z kimś'),
              L('a meeting / group', 'mityng / grupa'),
            ],
            fr(1),
          ),
          ticks(
            'more',
            undefined,
            [
              L('breathing', 'oddech'),
              L('music', 'muzyka'),
              L('sleep / rest', 'sen / odpoczynek'),
              L('writing my thoughts down', 'zapisanie myśli'),
              L('talking to my therapist', 'rozmowa z terapeutą'),
              L('other:', 'inne:'),
            ],
            fr(1),
          ),
        ],
        { height: mmH(46) },
      ),
      block(
        'best',
        'numbered-list',
        {
          title: L('My three most effective strategies', 'Moje trzy najskuteczniejsze strategie'),
          count: 3,
        },
        { height: mmH(32) },
      ),
      stack(
        [
          block(
            'wave',
            'text',
            {
              text: L(
                'It rises → it peaks → it falls.\nI do not have to fight it. I do not have to act on it. I can watch it until it passes.',
                'Narasta → osiąga szczyt → opada.\nNie muszę z nim walczyć. Nie muszę go realizować. Mogę go obserwować, aż przejdzie.',
              ),
              variant: 'body',
            },
            { height: mmH(14) },
          ),
          writeLines(
            'where',
            L('Where do I feel the craving in my body?', 'Gdzie czuję głód w ciele?'),
            mmH(20),
          ),
          block(
            'strength',
            'text',
            {
              text: L(
                `How does its strength change? ${NUM} → ${NUM} → ${NUM} → ${NUM} /10`,
                `Jak zmienia się jego siła? ${NUM} → ${NUM} → ${NUM} → ${NUM} /10`,
              ),
              variant: 'body',
            },
            { height: mmH(8) },
          ),
          writeLines(
            'ride-out',
            L('What helps me ride out the wave?', 'Co pomaga mi przeczekać falę?'),
            fr(1),
          ),
        ],
        { height: fr(1), label: L('A craving is a wave', 'Głód jest falą'), gap: 3 },
      ),
    ],
    { gap: 4 },
  ),
};

const relapseChain: PageTemplate = {
  id: 'relapse-chain',
  name: L('My relapse chain', 'Mój łańcuch nawrotu'),
  rationale: L(
    'Relapse usually starts long before using, as a chain of small changes. Knowing one’s own chain shows the earliest place to break it.',
    'Nawrót zwykle zaczyna się długo przed użyciem, jako łańcuch drobnych zmian. Znajomość własnego łańcucha pokazuje, gdzie najwcześniej go przerwać.',
  ),
  body: stack(
    [
      heading('heading', L('My relapse chain', 'Mój łańcuch nawrotu')),
      caption(
        'how',
        L(
          'How does trouble usually start for me? Write your own typical sequence, step by step.',
          'Jak zwykle zaczyna się u mnie problem? Zapisz swój typowy przebieg, krok po kroku.',
        ),
      ),
      writeLines('first', L('1. First I start…', '1. Najpierw zaczynam…'), fr(1)),
      writeLines('think', L('↓ 2. Then I start thinking…', '↓ 2. Potem zaczynam myśleć…'), fr(1)),
      writeLines('neglect', L('↓ 3. Next I neglect…', '↓ 3. Następnie zaniedbuję…'), fr(1)),
      writeLines('pull-away', L('↓ 4. I pull away from…', '↓ 4. Odsuwam się od…'), fr(1)),
      writeLines(
        'tell-myself',
        L('↓ 5. I start telling myself…', '↓ 5. Zaczynam sobie tłumaczyć…'),
        fr(1),
      ),
      writeLines('risk', L('↓ 6. The risk grows when…', '↓ 6. Ryzyko rośnie, gdy…'), fr(1)),
      block(
        'break',
        'writing-area',
        {
          title: L(
            'The earliest I can break this chain is here:',
            'Najwcześniej mogę przerwać ten łańcuch tutaj:',
          ),
          pattern: 'lines',
          framed: true,
        },
        { height: fr(1) },
      ),
      writeLines('then', L('Then I will:', 'Wtedy zrobię:'), fr(1)),
    ],
    { gap: 3 },
  ),
};

const afterSlip: PageTemplate = {
  id: 'after-slip',
  name: L('If I slipped', 'Jeśli doszło do potknięcia'),
  rationale: L(
    'A plan for after a slip, without the language of failure: recovery is a process, and the next hour matters more than counting lost days.',
    'Plan na czas po potknięciu, bez języka porażki: zdrowienie jest procesem, a najbliższa godzina jest ważniejsza niż liczenie straconych dni.',
  ),
  body: stack(
    [
      heading('heading', L('If I slipped', 'Jeśli doszło do potknięcia')),
      caption(
        'how',
        L(
          'One event does not have to decide what I do next.',
          'Jedno zdarzenie nie musi decydować o tym, co zrobię dalej.',
        ),
      ),
      writeLines('what', L('What happened?', 'Co się wydarzyło?'), fr(1)),
      writeLines('before', L('What was happening before?', 'Co działo się wcześniej?'), fr(1)),
      writeLines(
        'risk-now',
        L('What now raises the risk of using more?', 'Co teraz zwiększa ryzyko dalszego używania?'),
        fr(1),
      ),
      writeLines(
        'next-hour',
        L('What will I do in the next hour?', 'Co zrobię w ciągu najbliższej godziny?'),
        fr(1),
      ),
      writeLines('contact', L('Who will I contact?', 'Z kim się skontaktuję?'), fr(1)),
      writeLines(
        'safety',
        L('How will I keep myself safe?', 'Jak zadbam o bezpieczeństwo?'),
        fr(1),
      ),
      writeLines('learn', L('What can I learn from it?', 'Czego mogę się nauczyć?'), fr(1)),
      block(
        'next-step',
        'writing-area',
        {
          title: L('What is my next small step?', 'Jaki jest mój następny mały krok?'),
          pattern: 'lines',
          framed: true,
        },
        { height: fr(1) },
      ),
    ],
    { gap: 3 },
  ),
};

const cravingCard: PageTemplate = {
  id: 'craving-card',
  name: L('Craving card', 'Karta głodu'),
  rationale: L(
    'For a strong craving (e.g. 4 or more): a record of the moment, how the craving changed over twenty minutes, and what worked. Over time the cards show patterns.',
    'Na silny głód (np. 4 i więcej): zapis chwili, jak głód zmieniał się przez dwadzieścia minut i co zadziałało. Z czasem karty pokazują wzorce.',
  ),
  body: stack(
    [
      heading('heading', L('When a craving comes', 'Kiedy pojawia się głód')),
      block(
        'when',
        'text',
        {
          text: L(`Date ${BLANK} · time ${NUM}`, `Data ${BLANK} · godzina ${NUM}`),
          variant: 'body',
        },
        { height: mmH(8) },
      ),
      writeLines('where', L('Where am I?', 'Gdzie jestem?'), fr(1)),
      writeLines('happened', L('What has just happened?', 'Co właśnie się wydarzyło?'), fr(1)),
      row(
        [
          ticks(
            'feel',
            L('What do I feel?', 'Co czuję?'),
            [
              L('tension', 'napięcie'),
              L('anger', 'złość'),
              L('sadness', 'smutek'),
              L('loneliness', 'samotność'),
              L('fear', 'lęk'),
              L('frustration', 'frustrację'),
              L('boredom', 'nudę'),
              L('euphoria', 'euforię'),
              L('tiredness', 'zmęczenie'),
              L('other:', 'inne:'),
            ],
            fr(1),
          ),
          block(
            'strength',
            'text',
            {
              text: L(
                `Craving\nat the start ${NUM} /10\nafter 10 minutes ${NUM} /10\nafter 20 minutes ${NUM} /10`,
                `Głód\nna początku ${NUM} /10\npo 10 minutach ${NUM} /10\npo 20 minutach ${NUM} /10`,
              ),
              variant: 'body',
            },
            { height: fr(1) },
          ),
        ],
        { height: mmH(62) },
      ),
      writeLines(
        'instead',
        L('What did I do instead of using?', 'Co {g:zrobiłem|zrobiłam} zamiast użycia?'),
        fr(1),
      ),
      writeLines('worked', L('What worked?', 'Co zadziałało?'), fr(1)),
      writeLines(
        'learned',
        L('What did I learn about myself?', 'Czego {g:dowiedziałem|dowiedziałam} się o sobie?'),
        fr(1),
      ),
    ],
    { gap: 3 },
  ),
};

// ---------------------------------------------------------------------------------------------
// Structure (expanded by the generator in M4)

const page = (id: string) => ({ page: id });

const sections: SectionTemplate[] = [
  {
    id: 'intro',
    title: L('Introduction', 'Wprowadzenie'),
    startOn: 'right',
    sheetAligned: true,
    // Front matter in roman numerals (the cover, i, is not printed); the first month starts at 1.
    numbering: { style: 'roman' },
    // "A good start" (the start module), then the contract and safety rules (recovery module).
    children: [
      page('cover'),
      page('how-to'),
      // In the Recovery Edition the therapeutic contract takes the place of the agreement.
      { page: 'agreement', when: { and: [moduleOn(START), moduleOff(RECOVERY)] } },
      { page: 'good-life', when: moduleOn(START) },
      { page: 'more-less', when: moduleOn(START) },
      { page: 'values', when: moduleOn(START) },
      { page: 'strengths', when: moduleOn(START) },
      { page: 'recharge', when: moduleOn(START) },
      { page: 'contract', when: moduleOn(RECOVERY) },
      { page: 'safety-rules', when: moduleOn(RECOVERY) },
    ],
  },
  {
    id: 'month',
    title: L('Month', 'Miesiąc'),
    repeat: { over: 'months' },
    sheetAligned: true,
    children: [
      page('month-divider'),
      page('month-open-left'),
      page('month-open-right'),
      {
        id: 'week',
        title: L('Week', 'Tydzień'),
        repeat: { over: 'weeksOfMonth' },
        children: [
          page('week-left'),
          page('week-right'),
          {
            id: 'day',
            title: L('Day', 'Dzień'),
            repeat: { over: 'daysOfWeek', group: 1 },
            children: [page('day-left'), page('day-right')],
          },
          // The end of the week as one spread: "My week", then the situation analysis when the
          // CBT module is on.
          page('week-review'),
          { page: 'situation', when: moduleOn(CBT) },
        ],
      },
      page('wheel-of-life'),
      page('monthly-review'),
      page('month-patterns'),
      page('month-next'),
      page('notes'),
      page('notes'),
    ],
  },
  {
    id: 'crisis',
    title: L('Crisis and relapse prevention', 'Kryzys i zapobieganie nawrotom'),
    when: moduleOn(RECOVERY),
    sheetAligned: true,
    // Its own sequence, S1, S2…: "the plan for a hard moment is S1" is easy to find in a hurry.
    numbering: { style: 'arabic', prefix: 'S', restart: true },
    // The plan for a hard moment first: the page needed fastest opens the section on a
    // right-hand page. The order keeps the warning signs spread facing, with no blank pages.
    children: [
      page('sos'),
      page('craving-thresholds'),
      page('emergency-list'),
      page('warning-signs-left'),
      page('warning-signs-right'),
      page('relapse-chain'),
      page('after-slip'),
      page('gains-losses'),
      page('support-network'),
      page('craving-card'),
      page('craving-card'),
    ],
  },
];

const pageTemplates = [
  cover,
  howTo,
  agreement,
  goodLife,
  moreLess,
  values,
  strengths,
  recharge,
  contract,
  safetyRules,
  monthDivider,
  monthOpenLeft,
  monthOpenRight,
  weekLeft,
  weekRight,
  dayLeft,
  dayRight,
  weekReview,
  situation,
  wheel,
  review,
  monthPatterns,
  monthNext,
  notes,
  warningLeft,
  warningRight,
  gainsLosses,
  supportNetwork,
  sosPage,
  cravingThresholds,
  emergencyList,
  relapseChain,
  afterSlip,
  cravingCard,
];

export const therapeuticRecoveryTemplate: PlannerTemplate = {
  schemaVersion: TEMPLATE_MIGRATIONS.current,
  id: 'therapeutic-recovery-6-month',
  version: '1.0.0',
  name: L('Day by Day', 'Dzień po Dniu'),
  description: L(
    'A six-month recovery planner: daily two-page spreads with a morning check-in and commitment, priorities, HALT check and evening reflection; weekly and monthly spreads; Wheel of Life; and a crisis and relapse-prevention section.',
    'Sześciomiesięczny planer zdrowienia: dwustronicowe rozkładówki dnia z porannym check-inem i zobowiązaniem, priorytetami, skalą HALT i wieczorną refleksją; rozkładówki tygodni i miesięcy; Koło Życia oraz sekcja kryzysowa i zapobiegania nawrotom.',
  ),
  supportedFormats: ['A4', 'A5'],
  supportedLocales: ['en', 'pl'],
  defaults: {
    print: defaultPrintSettings('A4'),
    theme: {},
    generation: {
      durationMonths: 6,
      monthMode: 'calendar',
      weekOwnership: 'monday',
      dailyLayout: 'spread',
      weeklyLayout: 'spread',
      quoteCadence: 'daily',
      volumes: 1,
    },
  },
  pageTemplates: Object.fromEntries(
    pageTemplates.map((p) => [
      p.id,
      {
        ...p,
        ...(GUIDES[p.id] ? { guide: GUIDES[p.id] } : {}),
        ...(SAMPLES[p.id]
          ? { sampleContent: SAMPLES[p.id] as NonNullable<PageTemplate['sampleContent']> }
          : {}),
        // Basic and Balance: neutral examples for the blocks whose wording changes.
        ...(SAMPLES_NEUTRAL[p.id]
          ? {
              sampleVariants: [
                {
                  when: BALANCE,
                  content: SAMPLES_NEUTRAL[p.id] as NonNullable<PageTemplate['sampleContent']>,
                },
              ],
            }
          : {}),
      },
    ]),
  ),
  sections,
  modules: MODULES,
  presets: PRESETS,
  variables: [
    { name: 'patientName', label: L('Name', 'Imię'), type: 'text', personal: true },
    {
      name: 'therapistName',
      label: L('Therapist', 'Terapeuta / terapeutka'),
      type: 'text',
      personal: true,
    },
    {
      name: 'sobrietyStartDate',
      label: L('Sobriety start date', 'Data rozpoczęcia trzeźwości'),
      type: 'date',
      personal: true,
    },
  ],
  contentLibraryRefs: ['quotes'],
};

/** Stable, reviewable JSON: two-space indent and a trailing newline. */
export const serializeTemplate = (template: PlannerTemplate): string =>
  `${JSON.stringify(template, null, 2)}\n`;
