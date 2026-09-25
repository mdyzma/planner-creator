import { HALT_ROWS, SOS_STEPS } from '@planner/blocks';
import type { JsonPatchOp, PageTemplate, PlannerTemplate, SectionTemplate } from '@planner/schema';
import { TEMPLATE_MIGRATIONS, defaultPrintSettings } from '@planner/schema';
import { L, block, fr, mmH, pointerToBlock, railBlock, row, stack } from './dsl';

/**
 * Therapeutic Recovery Planner — 6 months (brief §5–§21), authored in TypeScript for type
 * checking and compiled to template.json, the data the app loads. The layout follows the
 * reference demo with the daily spread reversed: morning and day on the left, evening on the
 * right (design §5.3).
 */

const heading = (id: string, text: ReturnType<typeof L>, height = 12) =>
  block(id, 'text', { text, variant: 'heading' }, { height: mmH(height) });
const caption = (id: string, text: ReturnType<typeof L>, height = 8) =>
  block(id, 'text', { text, variant: 'caption' }, { height: mmH(height) });

/** Adjustments for A5 (148 × 210 mm): fewer lines where space runs out (§5.3). */
function a5(
  template: PageTemplate,
  changes: Array<[blockId: string, path: string, value: unknown]>,
): PageTemplate {
  const ops: JsonPatchOp[] = changes.map(([id, path, value]) => {
    const pointer = pointerToBlock(template.body, id);
    if (!pointer) throw new Error(`A5 override: no block "${id}" in ${template.id}`);
    // 'add' sets or replaces a member, so it also works for props left at the block defaults.
    return { op: 'add', path: `${pointer}/${path}`, value: value as JsonPatchOp['value'] };
  });
  return { ...template, formatOverrides: { A5: ops } };
}

// ---------------------------------------------------------------------------------------------
// Introduction

const cover: PageTemplate = {
  id: 'cover',
  name: L('Cover', 'Strona tytułowa'),
  body: stack(
    [
      block('top', 'spacer', {}, { height: fr(2) }),
      heading('title', L('Therapeutic Recovery Planner', 'Planer terapeutyczny zdrowienia'), 16),
      block(
        'subtitle',
        'text',
        {
          text: L('Six months, one day at a time', 'Sześć miesięcy, dzień po dniu'),
          variant: 'subheading',
        },
        { height: mmH(10) },
      ),
      block('gap', 'spacer', {}, { height: fr(1) }),
      block(
        'owner',
        'writing-area',
        { title: L('This planner belongs to', 'Ten planer należy do'), pattern: 'lines', pitch: 8 },
        { height: mmH(16) },
      ),
      block(
        'start',
        'writing-area',
        { title: L('I start on', 'Zaczynam dnia'), pattern: 'lines', pitch: 8 },
        { height: mmH(16) },
      ),
      block('bottom', 'spacer', {}, { height: fr(1) }),
    ],
    { gap: 6 },
  ),
};

const howTo: PageTemplate = {
  id: 'how-to',
  name: L('How to use this planner', 'Jak korzystać z planera'),
  body: stack([
    heading('heading', L('How to use this planner', 'Jak korzystać z planera')),
    block(
      'body',
      'text',
      {
        variant: 'body',
        text: L(
          'Each day has two facing pages. In the morning, use the left page: your 24-hour commitment, up to three priorities and a plan for the day. During the day, check HALT: are you hungry, angry, lonely or tired? In the evening, use the right page to look back: what threatened your sobriety, what you felt, and what you are grateful for.\n\nEach week opens with a spread for the week’s focus and goals, which sit near the outer edge of the page. Each month opens with a calendar and your intentions, and ends with the Wheel of Life and a short review.\n\nThe crisis section at the back holds your warning signs, your balance of gains and losses, your support network and your SOS plan. Fill it in early, and keep it within reach.\n\nWrite by hand. There are no wrong answers, and nothing here is a test.',
          'Każdy dzień zajmuje dwie strony. Rano skorzystaj z lewej strony: zobowiązanie na 24 godziny, najwyżej trzy priorytety i plan dnia. W ciągu dnia sprawdzaj HALT: czy jesteś {g:głodny|głodna}, {g:zły|zła}, {g:samotny|samotna} lub {g:zmęczony|zmęczona}? Wieczorem na prawej stronie spójrz wstecz: co zagroziło Twojej trzeźwości, co {g:czułeś|czułaś} i za co jesteś {g:wdzięczny|wdzięczna}.\n\nKażdy tydzień zaczyna się rozkładówką z myślą przewodnią i celami tygodnia, umieszczonymi przy zewnętrznej krawędzi strony. Każdy miesiąc otwiera kalendarz i Twoje intencje, a zamyka Koło Życia i krótkie podsumowanie.\n\nSekcja kryzysowa na końcu zawiera Twoje sygnały ostrzegawcze, bilans zysków i strat, sieć wsparcia oraz plan SOS. Wypełnij ją wcześnie i trzymaj pod ręką.\n\nPisz odręcznie. Nie ma złych odpowiedzi i nic tu nie jest sprawdzianem.',
        ),
      },
      { height: fr(3) },
    ),
    block(
      'notes',
      'writing-area',
      { title: L('My notes', 'Moje notatki'), pattern: 'dots' },
      { height: fr(2) },
    ),
  ]),
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
          L('I eat, sleep and rest regularly (HALT).', 'Regularnie jem, śpię i odpoczywam (HALT).'),
          L(
            'I go to my meetings and therapy even when I do not feel like it.',
            'Chodzę na mityngi i terapię, nawet gdy nie mam ochoty.',
          ),
        ],
      },
      { height: fr(1) },
    ),
    caption(
      'emergency',
      L(
        'If you are in danger or thinking about harming yourself, call your local emergency number or go to the nearest emergency department.',
        'Jeśli grozi Ci niebezpieczeństwo lub myślisz o zrobieniu sobie krzywdy, zadzwoń pod lokalny numer alarmowy albo zgłoś się na najbliższy szpitalny oddział ratunkowy.',
      ),
      12,
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
        'intention',
        'writing-area',
        { title: L('Main intention', 'Główna intencja'), pattern: 'lines' },
        { height: mmH(26) },
      ),
      block(
        'goals',
        'numbered-list',
        {
          title: L('Main goals this month (3–4)', 'Główne cele miesiąca (3–4)'),
          count: 4,
          marker: 'checkbox',
        },
        { height: fr(1) },
      ),
    ]),
  },
  [
    ['calendar', 'size/height', { mm: 76 }],
    ['intention', 'size/height', { mm: 20 }],
  ],
);

const monthOpenRight = a5(
  {
    id: 'month-open-right',
    name: L('Month opening (right)', 'Otwarcie miesiąca (prawa)'),
    spread: { group: 'month-open', position: 'right' },
    body: stack([
      block(
        'focus',
        'writing-area',
        { title: L('Recovery focus', 'Fokus zdrowienia'), pattern: 'lines', pitch: 6 },
        { height: mmH(12) },
      ),
      block('calendar', 'calendar-grid', { columns: [4, 7] }, { height: mmH(110) }),
      block(
        'remember',
        'writing-area',
        {
          title: L('This month I want to remember…', 'W tym miesiącu chcę pamiętać o…'),
          pattern: 'lines',
          framed: true,
        },
        { height: mmH(26) },
      ),
      row(
        [
          block('appointments', 'writing-area', {
            title: L('Meetings, therapy and appointments', 'Mityngi, terapia i wizyty'),
            pattern: 'lines',
          }),
          block('habits', 'writing-area', {
            title: L('Habits and milestones', 'Nawyki i kamienie milowe'),
            pattern: 'lines',
          }),
        ],
        { height: fr(1) },
      ),
    ]),
  },
  [
    ['calendar', 'size/height', { mm: 76 }],
    ['remember', 'size/height', { mm: 20 }],
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
        { title: L('Goals this week (3–4)', 'Cele tygodnia (3–4)'), count: 4, marker: 'checkbox' },
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
      'remember',
      'writing-area',
      {
        title: L('This week remember:', 'W tym tygodniu pamiętaj o:'),
        pattern: 'lines',
        framed: true,
      },
      { height: mmH(28) },
    ),
    block('mon', 'day-strip', { weekday: 0 }),
    block('tue', 'day-strip', { weekday: 1 }),
    block('wed', 'day-strip', { weekday: 2 }),
  ]),
};

const weekRight: PageTemplate = {
  id: 'week-right',
  name: L('Week (right)', 'Tydzień (prawa)'),
  spread: { group: 'week', position: 'right' },
  outerRailWidth: 34,
  outerRail: [
    railBlock(
      'wins',
      'writing-area',
      { title: L('Wins this week', 'Zwycięstwa tygodnia'), pattern: 'lines' },
      fr(1),
    ),
    railBlock(
      'helped',
      'writing-area',
      { title: L('What protected my calm', 'Co chroniło mój spokój'), pattern: 'lines' },
      fr(1),
    ),
  ],
  body: stack([
    block('thu', 'day-strip', { weekday: 3 }),
    block('fri', 'day-strip', { weekday: 4 }),
    block('sat', 'day-strip', { weekday: 5 }),
    block('sun', 'day-strip', { weekday: 6 }),
    block('legend', 'marker-legend', {}, { height: 'auto' }),
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
        row(
          [
            block('date', 'day-header', {}, { width: fr(2) }),
            block('quote', 'quote', {}, { width: fr(3) }),
          ],
          {
            height: mmH(20),
          },
        ),
        stack(
          [
            block(
              'commitment',
              'writing-area',
              {
                title: L(
                  'Today, for the next 24 hours, I will do everything I can to protect my sobriety by…',
                  'Dzisiaj, przez najbliższe 24 godziny, zrobię wszystko, aby utrzymać abstynencję poprzez…',
                ),
                pattern: 'lines',
              },
              { height: fr(1) },
            ),
          ],
          { height: mmH(34), label: L('Morning', 'Poranek') },
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
              block(
                'schedule',
                'time-grid',
                { title: L('Plan of the day', 'Plan dnia'), from: 7, to: 18, linesPerSlot: 2 },
                { width: fr(2) },
              ),
            ]),
          ],
          { height: fr(1), label: L('Day', 'Dzień') },
        ),
        block(
          'halt',
          'rating-matrix',
          {
            title: L('HALT check (1 = not at all, 5 = very)', 'Skala HALT (1 = wcale, 5 = bardzo)'),
            rows: HALT_ROWS,
            mode: 'scale-1-5',
            noteColumn: true,
            noteLabel: L('What helped?', 'Co pomogło?'),
          },
          { height: mmH(44) },
        ),
      ],
      { gap: 5 },
    ),
  },
  [
    ['schedule', 'props/linesPerSlot', 1],
    ['priorities', 'props/subLines', [L('If it gets hard:', 'Gdy będzie trudno:')]],
    ['halt', 'size/height', { mm: 36 }],
    ['quote', 'props/fallbackLines', 1],
  ],
);

const dayRight: PageTemplate = {
  id: 'day-right',
  name: L('Day: evening (right)', 'Dzień: wieczór (prawa)'),
  spread: { group: 'day', position: 'right' },
  rationale: L(
    'The largest writing space in the planner: a 5 mm dot grid for the evening reflection, framed by two relapse-prevention questions.',
    'Największa przestrzeń do pisania w planerze: kropki 5 mm na wieczorną refleksję, między dwoma pytaniami chroniącymi przed nawrotem.',
  ),
  body: stack(
    [
      block(
        'threat',
        'writing-area',
        {
          title: L('What threatened my sobriety today?', 'Co dzisiaj zagroziło mojej trzeźwości?'),
          pattern: 'lines',
        },
        { height: mmH(32) },
      ),
      block(
        'reflection',
        'writing-area',
        { title: L('Reflections on the day', 'Refleksje z dnia'), pattern: 'dots', pitch: 5 },
        { height: fr(1) },
      ),
      block(
        'gratitude',
        'numbered-list',
        {
          title: L('What am I grateful for today?', 'Za co jestem dziś {g:wdzięczny|wdzięczna}?'),
          count: 3,
        },
        { height: mmH(32) },
      ),
    ],
    { gap: 5, label: L('Evening', 'Wieczór') },
  ),
};

const wheel: PageTemplate = {
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
    block('wheel', 'radial-scale', {}, { height: fr(1) }),
    block(
      'notice',
      'writing-area',
      { title: L('What do I notice?', 'Co zauważam?'), pattern: 'lines' },
      { height: mmH(40) },
    ),
  ]),
};

const REVIEW_PROMPTS = [
  L('What helped me most this month?', 'Co najbardziej mi pomogło w tym miesiącu?'),
  L('What was difficult?', 'Co było trudne?'),
  L('What warning signs did I notice?', 'Jakie sygnały ostrzegawcze {g:zauważyłem|zauważyłam}?'),
  L('What did I learn about myself?', 'Czego {g:dowiedziałem|dowiedziałam} się o sobie?'),
  L('What do I want to continue next month?', 'Co chcę kontynuować w przyszłym miesiącu?'),
  L('What needs more attention?', 'Co wymaga więcej uwagi?'),
];

const review: PageTemplate = {
  id: 'monthly-review',
  name: L('Monthly review', 'Podsumowanie miesiąca'),
  spread: { group: 'month-end', position: 'right' },
  body: stack([
    heading('heading', L('Monthly review', 'Podsumowanie miesiąca')),
    ...REVIEW_PROMPTS.map((title, i) =>
      block(`prompt-${i + 1}`, 'writing-area', { title, pattern: 'lines' }, { height: fr(1) }),
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
        'Write the signs you know from your own experience. The examples are only a prompt; cross out what does not fit.',
        'Zapisz sygnały, które znasz z własnego doświadczenia. Przykłady są tylko podpowiedzią; skreśl to, co nie pasuje.',
      ),
      10,
    ),
    block(
      'grid',
      'category-grid',
      {
        columns: 1,
        cells: [
          {
            title: L('Body', 'Ciało'),
            examples: [
              E('insomnia', 'bezsenność'),
              E('muscle tension', 'napięcie mięśni'),
              E('jaw clenching', 'zaciskanie szczęki'),
              E('exhaustion', 'wyczerpanie'),
            ],
          },
          {
            title: L('Thoughts', 'Myśli'),
            examples: [
              E('“One time will not hurt.”', '„Jeden raz nie zaszkodzi.”'),
              E('“I can control it now.”', '„Teraz już nad tym panuję.”'),
              E('“I do not need meetings anymore.”', '„Nie potrzebuję już mityngów.”'),
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
        cells: [
          {
            title: L('Emotions', 'Emocje'),
            examples: [
              E('frustration', 'frustracja'),
              E('self-pity', 'użalanie się nad sobą'),
              E('anger', 'złość'),
              E('hopelessness', 'beznadzieja'),
            ],
          },
          {
            title: L('Behaviours', 'Zachowania'),
            examples: [
              E('isolation', 'izolowanie się'),
              E('avoiding meetings', 'unikanie mityngów'),
              E('lying', 'kłamstwa'),
              E('abandoning routines', 'porzucanie codziennych rutyn'),
            ],
          },
        ],
      },
      { height: fr(1) },
    ),
    block(
      'three-signs',
      'writing-area',
      {
        title: L(
          'When I notice three of these signs, I will…',
          'Gdy zauważę trzy z tych sygnałów, zrobię…',
        ),
        pattern: 'lines',
        framed: true,
      },
      { height: mmH(36) },
    ),
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
          L('Alternative phone', 'Telefon dodatkowy'),
          L('Notes', 'Uwagi'),
        ],
      },
      { height: fr(1) },
    ),
  ]),
};

const sos: PageTemplate = {
  id: 'sos',
  name: L('SOS plan', 'Plan SOS'),
  body: stack([
    heading('heading', L('My SOS plan', 'Mój plan SOS')),
    block(
      'steps',
      'numbered-list',
      { title: L('Five steps', 'Pięć kroków'), items: SOS_STEPS, count: 5, lineHeight: 10 },
      { height: mmH(70) },
    ),
    block(
      'strategy',
      'writing-area',
      {
        title: L('My emergency coping strategy', 'Moja awaryjna strategia radzenia sobie'),
        pattern: 'lines',
        framed: true,
      },
      { height: fr(1) },
    ),
    block(
      'places',
      'writing-area',
      {
        title: L(
          'Safe places and meetings I can go to',
          'Bezpieczne miejsca i mityngi, do których mogę pójść',
        ),
        pattern: 'lines',
      },
      { height: mmH(40) },
    ),
  ]),
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
    children: [page('cover'), page('how-to'), page('contract'), page('safety-rules')],
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
        ],
      },
      page('wheel-of-life'),
      page('monthly-review'),
      page('notes'),
      page('notes'),
    ],
  },
  {
    id: 'crisis',
    title: L('Crisis and relapse prevention', 'Kryzys i zapobieganie nawrotom'),
    sheetAligned: true,
    // SOS first: the page needed fastest opens the section on a right-hand page.
    children: [
      page('sos'),
      page('warning-signs-left'),
      page('warning-signs-right'),
      page('gains-losses'),
      page('support-network'),
    ],
  },
];

const pageTemplates = [
  cover,
  howTo,
  contract,
  safetyRules,
  monthDivider,
  monthOpenLeft,
  monthOpenRight,
  weekLeft,
  weekRight,
  dayLeft,
  dayRight,
  wheel,
  review,
  notes,
  warningLeft,
  warningRight,
  gainsLosses,
  supportNetwork,
  sos,
];

export const therapeuticRecoveryTemplate: PlannerTemplate = {
  schemaVersion: TEMPLATE_MIGRATIONS.current,
  id: 'therapeutic-recovery-6-month',
  version: '1.0.0',
  name: L(
    'Therapeutic Recovery Planner — 6 Months',
    'Planer terapeutyczny zdrowienia — 6 miesięcy',
  ),
  description: L(
    'A six-month recovery planner: daily two-page spreads with a 24-hour commitment, priorities, HALT check and evening reflection; weekly and monthly spreads; Wheel of Life; and a crisis and relapse-prevention section.',
    'Sześciomiesięczny planer zdrowienia: dwustronicowe rozkładówki dnia z zobowiązaniem na 24 godziny, priorytetami, skalą HALT i wieczorną refleksją; rozkładówki tygodni i miesięcy; Koło Życia oraz sekcja kryzysowa i zapobiegania nawrotom.',
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
  pageTemplates: Object.fromEntries(pageTemplates.map((p) => [p.id, p])),
  sections,
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
