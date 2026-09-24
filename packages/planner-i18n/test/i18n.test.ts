import type { PlannerProject } from '@planner/schema';
import { blankTemplate, createProject, parseProject } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import {
  applyGender,
  copyTranslation,
  formatDate,
  formatMonth,
  isLocalizedText,
  isoWeekNumber,
  localize,
  missingLocales,
  plural,
  scanTranslations,
  setAtPath,
  weekdayName,
  weekdayNames,
} from '../src';

describe('text', () => {
  it('localizes with fallback and treats blank strings as missing', () => {
    expect(localize({ en: 'Morning', pl: 'Poranek' }, 'pl')).toBe('Poranek');
    expect(localize({ en: 'Morning', pl: '  ' }, 'pl')).toBe('Morning');
    expect(localize({}, 'pl')).toBe('');
    expect(missingLocales({ en: 'x', pl: '' })).toEqual(['pl']);
  });

  it('copies a translation only into an empty target unless asked to overwrite', () => {
    expect(copyTranslation({ en: 'Day' }, 'en', 'pl')).toEqual({ en: 'Day', pl: 'Day' });
    expect(copyTranslation({ en: 'Day', pl: 'Dzień' }, 'en', 'pl')).toEqual({
      en: 'Day',
      pl: 'Dzień',
    });
    expect(copyTranslation({ en: 'Day', pl: 'Dzień' }, 'en', 'pl', { overwrite: true }).pl).toBe(
      'Day',
    );
    expect(copyTranslation({ pl: 'Dzień' }, 'en', 'pl')).toEqual({ pl: 'Dzień' });
  });

  it('recognises LocalizedText-shaped values', () => {
    expect(isLocalizedText({ en: 'a', pl: 'b' })).toBe(true);
    expect(isLocalizedText({ en: 'a' })).toBe(true);
    expect(isLocalizedText({})).toBe(false);
    expect(isLocalizedText({ en: 'a', count: 3 })).toBe(false);
    expect(isLocalizedText({ de: 'a' })).toBe(false);
    expect(isLocalizedText(['en'])).toBe(false);
  });
});

describe('dates', () => {
  it('uses the nominative month alone and the genitive inside a date (Polish)', () => {
    expect(formatMonth('2026-10-01', 'pl', 'standalone')).toBe('Październik');
    expect(formatMonth('2026-10-01', 'pl', 'with-year')).toBe('Październik 2026');
    expect(formatDate('2026-10-01', 'pl', 'day-month')).toBe('1 października');
    expect(formatMonth('2026-10-01', 'en', 'standalone')).toBe('October');
    expect(formatDate('2026-10-01', 'en', 'day-month')).toBe('October 1');
  });

  it('formats weekdays and never shifts the day by time zone', () => {
    expect(weekdayName('2026-10-01', 'pl')).toBe('Czwartek');
    expect(formatDate('2026-10-05', 'pl', 'weekday-day-month')).toBe(
      'Poniedziałek, 5 października',
    );
    expect(formatDate('2026-12-31', 'en', 'full')).toBe('Thursday, December 31, 2026');
    expect(weekdayNames('pl', 'short')[0]).toBe('Pon.');
    expect(weekdayNames('en', 'short')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it.each([
    ['2026-01-01', 1],
    ['2026-10-01', 40],
    ['2026-12-28', 53],
    ['2027-01-03', 53],
    ['2027-01-04', 1],
    ['2021-01-03', 53],
  ])('ISO week of %s is %i', (date, week) => {
    expect(isoWeekNumber(date)).toBe(week);
  });
});

describe('grammar', () => {
  const days = { one: '{n} dzień', few: '{n} dni', many: '{n} dni', other: '{n} dnia' };

  it('picks Polish and English plural forms', () => {
    expect(plural('pl', 1, days)).toBe('1 dzień');
    expect(plural('pl', 3, days)).toBe('3 dni');
    expect(plural('pl', 22, days)).toBe('22 dni');
    expect(plural('pl', 1.5, days)).toBe('1.5 dnia');
    expect(plural('en', 1, { one: '{n} day', other: '{n} days' })).toBe('1 day');
    expect(plural('en', 2, { one: '{n} day', other: '{n} days' })).toBe('2 days');
  });

  it('resolves gendered wording by project setting', () => {
    const q = 'Za co jestem dziś {g:wdzięczny|wdzięczna}?';
    expect(applyGender(q, 'slash')).toBe('Za co jestem dziś wdzięczny / wdzięczna?');
    expect(applyGender(q, 'feminine')).toBe('Za co jestem dziś wdzięczna?');
    expect(applyGender(q, 'masculine')).toBe('Za co jestem dziś wdzięczny?');
    expect(applyGender(q, 'neutral')).toBe('Za co jestem dziś wdzięczny / wdzięczna?');
    expect(applyGender('{g:gotowy|gotowa|w gotowości}', 'neutral')).toBe('w gotowości');
    expect(applyGender('No tokens here', 'feminine')).toBe('No tokens here');
  });
});

describe('scanTranslations', () => {
  const base = createProject({
    id: 'p',
    name: 'P',
    format: 'A4',
    locale: 'pl',
    now: '2026-01-01T00:00:00.000Z',
  });
  const project: PlannerProject = {
    ...base,
    template: {
      ...blankTemplate(),
      pageTemplates: {
        daily: {
          id: 'daily',
          name: { en: 'Daily', pl: 'Dzień' },
          rationale: { en: 'Evening on the right.' },
          body: {
            kind: 'stack',
            gap: 2,
            label: { en: 'Morning', pl: 'Poranek' },
            children: [
              {
                kind: 'block',
                block: {
                  id: 'q',
                  type: 'reflection-question',
                  props: { title: { en: 'What threatened my sobriety today?', pl: '' }, lines: 3 },
                },
              },
            ],
          },
          outerRail: [
            { id: 'goals', type: 'numbered-list', props: { items: [{ en: 'Goal', pl: 'Cel' }] } },
          ],
        },
      },
      variables: [{ name: 'patientName', label: { en: 'Name' }, type: 'text', personal: true }],
    },
    content: [
      {
        schemaVersion: 1,
        library: 'quotes',
        items: [
          {
            id: 'q1',
            kind: 'quote',
            text: { en: 'One day.', pl: 'Jeden dzień.' },
            license: 'original',
            categories: [],
            tags: [],
          },
          {
            id: 'q2',
            kind: 'quote',
            text: { pl: 'Tylko polski.' },
            license: 'original',
            categories: [],
            tags: [],
          },
        ],
      },
    ],
    document: {
      root: {
        key: 'root',
        title: { en: 'Root' },
        enabled: true,
        children: [
          { key: 'm1', title: { en: 'October', pl: 'Październik' }, enabled: true, children: [] },
        ],
      },
    },
  };

  const report = scanTranslations(project);
  const byField = (ownerId: string, field: string) =>
    report.entries.find((e) => e.ownerId === ownerId && e.field === field);

  it('finds texts in templates, layout, block props, rails, variables, content and sections', () => {
    expect(byField('daily', 'name')?.missing).toEqual([]);
    expect(byField('daily', 'rationale')?.missing).toEqual(['pl']);
    expect(byField('daily', 'label')?.text.pl).toBe('Poranek');
    expect(byField('daily › q', 'props.title')?.missing).toEqual(['pl']);
    expect(byField('daily › goals', 'props.items[0]')?.text.pl).toBe('Cel');
    expect(byField('patientName', 'label')?.missing).toEqual(['pl']);
    expect(byField('quotes › q2', 'text')?.missing).toEqual(['en']);
    expect(byField('m1', 'title')?.kind).toBe('document-section');
    expect(report.entries.some((e) => e.ownerId === 'root')).toBe(false);
  });

  it('counts missing translations per locale', () => {
    expect(report.missingByLocale).toEqual({ en: 1, pl: 3 });
    expect(report.total).toBe(report.entries.length);
  });

  it('writes an edited translation back to exactly its path', () => {
    const entry = byField('daily › q', 'props.title')!;
    const updated = setAtPath(project, entry.path, {
      ...entry.text,
      pl: 'Co dzisiaj zagroziło mojej trzeźwości?',
    });
    expect(parseProject(updated).ok).toBe(true);
    expect(scanTranslations(updated).missingByLocale.pl).toBe(2);
    expect(project.template.pageTemplates.daily).not.toBe(updated.template.pageTemplates.daily);
    expect(updated.content).toBe(project.content); // untouched branches are shared
  });
});
