import { describe, expect, it } from 'vitest';
import { createGeneratedProject } from '../src/lib/newProject';
import { layoutProject } from '../src/lib/pages';
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

describe('HALT variant', () => {
  it('names the planner’s HALT check on every page, for the instructions', () => {
    const { pages } = layoutProject(project);
    expect(pages[1]!.vars.haltName).toBe('HALT-B');
    expect(pages[1]!.vars.haltFeelings).toContain('{g:znudzony|znudzona}');
  });

  it('follows a switch to classic HALT', () => {
    const dayLeft = project.template.pageTemplates['day-left']!;
    const body = JSON.parse(
      JSON.stringify(dayLeft.body).replace('"variant":"halt-b"', '"variant":"halt"'),
    ) as typeof dayLeft.body;
    const classic = {
      ...project,
      template: {
        ...project.template,
        pageTemplates: { ...project.template.pageTemplates, 'day-left': { ...dayLeft, body } },
      },
    };
    const { pages } = layoutProject(classic);
    expect(pages[1]!.vars.haltName).toBe('HALT');
    expect(pages[1]!.vars.haltFeelings).not.toContain('znudzony');
  });
});
