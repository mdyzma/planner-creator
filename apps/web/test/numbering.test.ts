import type { SectionNode } from '@planner/schema';
import { isPageInstance } from '@planner/schema';
import { describe, expect, it } from 'vitest';
import { createGeneratedProject } from '../src/lib/newProject';
import { findPage, layoutProject } from '../src/lib/pages';
import { BUNDLED_TEMPLATES } from '../src/lib/templates';

const { project } = createGeneratedProject({
  bundle: BUNDLED_TEMPLATES[0]!,
  id: 'p',
  name: 'Test',
  format: 'A4',
  locale: 'pl',
  now: '2026-09-25T00:00:00.000Z',
  startDate: '2026-10-01',
  durationMonths: 1,
});

/** A planner as created before page numbering existed: no numbering anywhere. */
function withoutNumbering(): typeof project {
  const strip = (node: SectionNode): SectionNode => {
    const { numbering: _n, ...rest } = node;
    return { ...rest, children: node.children.map((c) => (isPageInstance(c) ? c : strip(c))) };
  };
  const pageTemplates = Object.fromEntries(
    Object.entries(project.template.pageTemplates).map(([id, page]) => {
      const { hidePageNumber: _h, ...rest } = page;
      return [id, rest];
    }),
  );
  const sections = project.template.sections.map(({ numbering: _n, ...rest }) => rest);
  return {
    ...project,
    template: { ...project.template, pageTemplates, sections },
    document: { root: strip(project.document.root) },
  };
}

describe('printed page labels', () => {
  it.each([
    ['a new planner', project],
    ['a planner from before numbering existed', withoutNumbering()],
  ])('%s: roman front matter, months from 1, crisis S1…', (_, p) => {
    const { pages } = layoutProject(p);
    const labels = pages.map((x) => x.label.text);
    // Cover, how-to, six “good start” pages, contract and safety rules: i–x.
    const divider = pages.findIndex((x) => x.page.instance?.templateId === 'month-divider');
    expect(divider).toBe(10);
    expect(labels.slice(0, divider)).toEqual([
      'i',
      'ii',
      'iii',
      'iv',
      'v',
      'vi',
      'vii',
      'viii',
      'ix',
      'x',
    ]);
    expect(pages[0]!.label.printed).toBe(false);
    expect(labels[divider]).toBe('1');
    const sos = pages.findIndex((x) => x.page.instance?.templateId === 'sos');
    expect(labels[sos]).toBe('S1');
  });

  it('finds pages by printed number first, then by position in the file', () => {
    const { pages } = layoutProject(project);
    expect(findPage(pages, 'iii')).toBe(2);
    expect(findPage(pages, '1')).toBe(10);
    expect(findPage(pages, 's1')).toBe(
      pages.findIndex((x) => x.page.instance?.templateId === 'sos'),
    );
    expect(findPage(pages, 'nope')).toBe(-1);
  });
});
