import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContentLibrary, parseProject, parseProjectJson, parseTemplate } from '../src';
import { contentLibrary, plannerProject, plannerTemplate } from './arbitraries';

const viaJson = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));

describe('JSON round-trip', () => {
  it('projects survive serialise → parse unchanged', () => {
    fc.assert(
      fc.property(plannerProject, (project) => {
        const first = parseProject(project);
        if (!first.ok) throw new Error(JSON.stringify(first.issues, null, 2));
        // The schema is lossless for valid input…
        expect(first.value).toEqual(project);
        // …and a saved file reads back to exactly the same project.
        const second = parseProjectJson(JSON.stringify(first.value));
        expect(second.ok && second.value).toEqual(first.value);
      }),
      { numRuns: 150 },
    );
  });

  it('templates survive serialise → parse unchanged', () => {
    fc.assert(
      fc.property(plannerTemplate, (template) => {
        const parsed = parseTemplate(viaJson(template));
        if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues, null, 2));
        expect(parsed.value).toEqual(template);
      }),
      { numRuns: 150 },
    );
  });

  it('content libraries survive serialise → parse unchanged', () => {
    fc.assert(
      fc.property(contentLibrary, (library) => {
        const parsed = parseContentLibrary(viaJson(library));
        if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues, null, 2));
        expect(parsed.value).toEqual(library);
      }),
    );
  });

  it('parsing is idempotent', () => {
    fc.assert(
      fc.property(plannerProject, (project) => {
        const once = parseProject(project);
        const twice = once.ok ? parseProject(once.value) : once;
        expect(twice).toEqual(once);
      }),
      { numRuns: 50 },
    );
  });
});

describe('rejects invalid input', () => {
  it('reports the path of a broken field', () => {
    fc.assert(
      fc.property(plannerProject, (project) => {
        const broken = { ...project, format: 'A3' };
        const result = parseProject(broken);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.issues.some((i) => i.path === 'format')).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects non-JSON and oversized files', () => {
    expect(parseProjectJson('{not json').ok).toBe(false);
    expect(parseProjectJson(' '.repeat(10 * 1024 * 1024 + 1)).ok).toBe(false);
  });
});
