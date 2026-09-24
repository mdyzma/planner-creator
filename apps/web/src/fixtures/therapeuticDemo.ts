import { addDays } from '@planner/i18n';
import type { FormatId, Locale, PageInstance, PlannerProject, SectionNode } from '@planner/schema';
import { createProject, parseContentLibrary, parseTemplate } from '@planner/schema';
import quotesJson from '@planner/template-therapeutic-recovery/content/quotes.json';
import templateJson from '@planner/template-therapeutic-recovery/template.json';

/**
 * The brief's demo project (§37): the therapeutic template with one month, one week and seven
 * daily spreads, plus the month-end and crisis pages. The structure is written out by hand until
 * the generator (M4) builds it from the template's sections.
 */

const template = parseTemplate(templateJson);
const quotes = parseContentLibrary(quotesJson);
if (!template.ok || !quotes.ok)
  throw new Error('Bundled therapeutic template or quotes are invalid.');

const START = '2026-10-01';
const WEEK_START = '2026-10-05'; // Monday
const week = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));

const page = (
  key: string,
  templateId: string,
  context: PageInstance['context'] = {},
  quoteId?: string,
): PageInstance => ({
  key,
  templateId,
  context,
  enabled: true,
  origin: 'generated',
  ...(quoteId ? { contentAssignments: { quote: quoteId } } : {}),
});

const section = (
  key: string,
  title: SectionNode['title'],
  children: SectionNode['children'],
  extra: Partial<SectionNode> = {},
): SectionNode => ({ key, title, enabled: true, children, ...extra });

function demoDocument(quoteIds: string[]): SectionNode {
  const month = { date: START };
  return section(
    'root',
    { en: 'Therapeutic Recovery Planner', pl: 'Planer terapeutyczny zdrowienia' },
    [
      section(
        'intro',
        { en: 'Introduction', pl: 'Wprowadzenie' },
        [
          page('intro/cover', 'cover'),
          page('intro/how-to', 'how-to'),
          page('intro/contract', 'contract'),
          page('intro/safety', 'safety-rules'),
        ],
        { startOn: 'right', sheetAligned: true },
      ),
      section(
        'm1',
        { en: 'October 2026', pl: 'Październik 2026' },
        [
          page('m1/divider', 'month-divider', month),
          page('m1/open/L', 'month-open-left', month),
          page('m1/open/R', 'month-open-right', month),
          section('m1/w1', { en: 'Week 1', pl: 'Tydzień 1' }, [
            page('m1/w1/L', 'week-left', { dates: week }),
            page('m1/w1/R', 'week-right', { dates: week }),
            ...week.flatMap((date, i) => [
              page(`m1/w1/d/${date}/L`, 'day-left', { date }, quoteIds[i % quoteIds.length]),
              page(`m1/w1/d/${date}/R`, 'day-right', { date }),
            ]),
          ]),
          page('m1/wheel', 'wheel-of-life', month),
          page('m1/review', 'monthly-review', month),
          page('m1/notes-1', 'notes'),
          page('m1/notes-2', 'notes'),
        ],
        { sheetAligned: true },
      ),
      section(
        'crisis',
        { en: 'Crisis and relapse prevention', pl: 'Kryzys i zapobieganie nawrotom' },
        [
          page('crisis/sos', 'sos'),
          page('crisis/warning/L', 'warning-signs-left'),
          page('crisis/warning/R', 'warning-signs-right'),
          page('crisis/gains-losses', 'gains-losses'),
          page('crisis/support', 'support-network'),
        ],
        { sheetAligned: true },
      ),
    ],
  );
}

export function createTherapeuticDemo(input: {
  id: string;
  name: string;
  now: string;
  format: FormatId;
  locale: Locale;
}): PlannerProject {
  if (!template.ok || !quotes.ok) throw new Error('unreachable');
  const project = createProject({ ...input, template: template.value });
  return {
    ...project,
    generation: { ...project.generation, startDate: START },
    content: [quotes.value],
    document: { root: demoDocument(quotes.value.items.map((q) => q.id)) },
  };
}
