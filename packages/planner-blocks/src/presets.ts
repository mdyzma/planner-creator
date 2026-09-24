import type { LocalizedText } from '@planner/schema';

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
  { badge: 'A', label: L('Angry / stressed', 'Złość / stres') },
  { badge: 'L', label: L('Lonely', 'Samotność / izolacja') },
  { badge: 'T', label: L('Tired', 'Zmęczenie / wyczerpanie') },
];

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
      rows: HALT_ROWS,
      mode: 'scale-1-5',
      noteColumn: true,
      noteLabel: L('What helped?', 'Co pomogło?'),
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
