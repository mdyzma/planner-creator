import type { LayoutNode, Locale, LocalizedText } from '@planner/schema';

const L = (en: string, pl: string) => ({ en, pl });

/**
 * Therapeutic components as configured generic blocks (§6): the editor palette lists these by
 * name, and templates start from them. Nothing here is special-cased by the renderer.
 */
export interface BlockPreset {
  id: string;
  label: LocalizedText;
  type: string;
  props: Record<string, unknown>;
}

export const HALT_ROWS = [
  { badge: 'H', label: L('Hungry', 'Głód fizyczny') },
  { badge: 'A', label: L('Angry / tense', 'Złość / napięcie') },
  { badge: 'L', label: L('Lonely', 'Samotność / izolacja') },
  { badge: 'T', label: L('Tired', 'Zmęczenie / wyczerpanie') },
];

/** HALT-B: HALT plus boredom, a common relapse trigger when the day has no structure. */
export const HALT_B_ROWS = [
  ...HALT_ROWS,
  { badge: 'B', label: L('Bored / without purpose', 'Nuda / brak celu') },
];

export type HaltVariant = 'halt' | 'halt-b';

/**
 * The HALT checks a rating table can be set to: its rows, its name, and the feelings it asks
 * about, for text such as "check {{haltName}}: are you {{haltFeelings}}?".
 */
export const HALT_VARIANTS: Record<
  HaltVariant,
  { name: string; rows: typeof HALT_B_ROWS; feelings: LocalizedText }
> = {
  halt: {
    name: 'HALT',
    rows: HALT_ROWS,
    feelings: L(
      'hungry, angry, lonely or tired',
      '{g:głodny|głodna}, {g:zły|zła}, {g:samotny|samotna} lub {g:zmęczony|zmęczona}',
    ),
  },
  'halt-b': {
    name: 'HALT-B',
    rows: HALT_B_ROWS,
    feelings: L(
      'hungry, angry, lonely, tired or bored',
      '{g:głodny|głodna}, {g:zły|zła}, {g:samotny|samotna}, {g:zmęczony|zmęczona} lub {g:znudzony|znudzona}',
    ),
  },
};

export const isHaltVariant = (v: unknown): v is HaltVariant =>
  typeof v === 'string' && v in HALT_VARIANTS;

/**
 * `{{haltName}}` and `{{haltFeelings}}` for a planner: taken from the first rating table set to a
 * HALT variant in its page templates, so the instructions match the printed rows. Empty when the
 * planner has none (the variables then print as a line to write on).
 */
export function haltVariables(
  pageTemplates: Record<string, { body: LayoutNode }>,
  locale: Locale,
): Record<string, string> {
  const find = (node: LayoutNode): HaltVariant | undefined => {
    if (node.kind === 'block') {
      const variant = (node.block.props as { variant?: unknown } | undefined)?.variant;
      return node.block.type === 'rating-matrix' && isHaltVariant(variant) ? variant : undefined;
    }
    for (const child of node.children) {
      const found = find(child);
      if (found) return found;
    }
    return undefined;
  };
  for (const page of Object.values(pageTemplates)) {
    const variant = find(page.body);
    if (variant) {
      const { name, feelings } = HALT_VARIANTS[variant];
      return { haltName: name, haltFeelings: feelings[locale] ?? feelings.en ?? '' };
    }
  }
  return {};
}

export const SOS_STEPS = [
  L('Stop and recognise what is happening.', 'Zatrzymaj się i nazwij, co się dzieje.'),
  L('Do not stay alone with the craving.', 'Nie zostawaj w samotności z głodem.'),
  L('Contact someone from my support network.', 'Skontaktuj się z kimś z mojej sieci wsparcia.'),
  L(
    'Change environment and remove access to alcohol or substances.',
    'Zmień otoczenie i usuń dostęp do alkoholu lub substancji.',
  ),
  L(
    'Use my emergency coping strategy and seek professional help if necessary.',
    'Zastosuj swoją awaryjną strategię radzenia sobie i w razie potrzeby szukaj profesjonalnej pomocy.',
  ),
];

export const BUILT_IN_PRESETS: BlockPreset[] = [
  {
    id: 'halt-tracker',
    label: L('HALT tracker', 'Skala HALT'),
    type: 'rating-matrix',
    props: {
      title: L('HALT check', 'Skala HALT'),
      variant: 'halt',
      rows: HALT_ROWS,
      mode: 'scale-1-5',
      noteColumn: true,
      noteLabel: L('Reason:', 'Powód:'),
    },
  },
  {
    id: 'halt-b-tracker',
    label: L('HALT-B tracker', 'Skala HALT-B'),
    type: 'rating-matrix',
    props: {
      title: L('HALT-B check', 'Skala HALT-B'),
      variant: 'halt-b',
      rows: HALT_B_ROWS,
      mode: 'scale-1-5',
      noteColumn: true,
      noteLabel: L('Reason:', 'Powód:'),
    },
  },
  {
    id: 'daily-goals',
    label: L('Daily goals', 'Cele dnia'),
    type: 'numbered-list',
    props: {
      title: L('My three priorities today', 'Moje trzy najważniejsze cele na dziś'),
      count: 3,
    },
  },
  {
    id: 'weekly-goals',
    label: L('Weekly goals', 'Cele tygodnia'),
    type: 'numbered-list',
    props: { title: L('Goals this week', 'Cele tygodnia'), count: 4, marker: 'checkbox' },
  },
  {
    id: 'monthly-goals',
    label: L('Monthly goals', 'Cele miesiąca'),
    type: 'numbered-list',
    props: {
      title: L('Main goals this month (3–4)', 'Główne cele miesiąca (3–4)'),
      count: 4,
      marker: 'checkbox',
    },
  },
  { id: 'wheel-of-life', label: L('Wheel of Life', 'Koło Życia'), type: 'radial-scale', props: {} },
  {
    id: 'sos-procedure',
    label: L('SOS procedure', 'Procedura SOS'),
    type: 'numbered-list',
    props: { title: L('SOS: five steps', 'SOS: pięć kroków'), items: SOS_STEPS, count: 5 },
  },
  {
    id: 'dot-grid',
    label: L('Dot grid (5 mm)', 'Kropki (5 mm)'),
    type: 'writing-area',
    props: { pattern: 'dots', pitch: 5 },
  },
  {
    id: 'lined-notes',
    label: L('Lined notes', 'Notatki w linie'),
    type: 'writing-area',
    props: { pattern: 'lines' },
  },
];
