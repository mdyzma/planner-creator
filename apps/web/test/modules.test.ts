import { PageView } from '@planner/renderer';
import type { FormatId, Locale, PlannerProject } from '@planner/schema';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGeneratedProject } from '../src/lib/newProject';
import { FILLER_PATTERN, blockRegistry, layoutProject } from '../src/lib/pages';
import { BUNDLED_TEMPLATES } from '../src/lib/templates';

const bundle = BUNDLED_TEMPLATES[0]!;
const preset = (id: string) => bundle.template.presets!.find((p) => p.id === id)!.modules;

const planner = (locale: Locale, format: FormatId, modules?: Record<string, boolean>) =>
  createGeneratedProject({
    bundle,
    id: 'm',
    name: 'Test',
    format,
    locale,
    now: '2026-09-25T00:00:00.000Z',
    startDate: '2026-10-01',
    durationMonths: 1,
    modules,
  }).project;

/** Every printed page as plain text. Quotes are left out: the quote library is not per module yet. */
function printedText(project: PlannerProject): string[] {
  const layout = layoutProject(project);
  return layout.pages.map((p) =>
    renderToStaticMarkup(
      createElement(PageView, {
        frame: p.frame,
        template: p.template,
        fillerPattern: FILLER_PATTERN,
        renderBlock: blockRegistry.render,
        pageContext: p.page.instance?.context,
        vars: p.vars,
        range: layout.range,
        contentFor: () => undefined,
        locale: project.locale,
        grammaticalGender: project.i18nOptions.grammaticalGender,
        mode: 'print',
      }),
    )
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

const templatesOf = (project: PlannerProject) =>
  new Set(layoutProject(project).pages.map((p) => p.page.instance?.templateId));

// Recovery and therapy words; "Głód fizyczny" / "Hungry" is HALT's physical hunger.
const RECOVERY_WORDS = {
  pl: /trzeźw|abstynen|mityng|nawrot|wyzwalacz|uzależni|terapi|głód(?! fizyczny)/i,
  en: /sobri|craving|relapse|meeting|addict|abstin|trigger|therap/i,
};

describe('modules and presets', () => {
  it('prints a Recovery Edition planner as before: crisis section, contract, sobriety counter', () => {
    const project = planner('pl', 'A4');
    const pages = templatesOf(project);
    for (const id of ['contract', 'safety-rules', 'sos', 'craving-card'])
      expect(pages).toContain(id);
    expect(pages).not.toContain('situation');
    expect(printedText(project).join(' ')).toContain('Dzień trzeźwości numer');
  });

  it.each([
    ['pl', 'A4'],
    ['pl', 'A5'],
    ['en', 'A4'],
    ['en', 'A5'],
  ] as const)(
    'prints a Balance planner (%s, %s) without recovery or therapy wording',
    (locale, format) => {
      const project = planner(locale, format, preset('balance'));
      const pages = templatesOf(project);
      for (const id of ['contract', 'safety-rules', 'sos', 'relapse-chain'])
        expect(pages).not.toContain(id);
      const text = printedText(project);
      const hits = text.flatMap((t, i) => {
        const m = t.match(RECOVERY_WORDS[locale]);
        return m ? [`page ${i + 1}: …${t.slice(Math.max(0, m.index! - 40), m.index! + 40)}…`] : [];
      });
      expect(hits).toEqual([]);
    },
  );

  it('is about 13 pages shorter as Balance, and adds the weekly situation page with CBT', () => {
    const recovery = layoutProject(planner('pl', 'A4')).pages.length;
    const balance = layoutProject(planner('pl', 'A4', preset('balance'))).pages.length;
    expect(recovery - balance).toBeGreaterThanOrEqual(12);
    const cbt = planner('pl', 'A4', { cbt: true });
    expect(templatesOf(cbt)).toContain('situation');
  });

  it('leaves out HALT when its module is off, and says nothing about it on the how-to page', () => {
    const project = planner('pl', 'A4', { halt: false });
    const text = printedText(project).join(' ');
    expect(text).not.toMatch(/HALT/);
    expect(text).toContain('Dzień trzeźwości numer');
  });
});
