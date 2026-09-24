import { describe, expect, it } from 'vitest';
import { PROJECT_MIGRATIONS, createProject, parseProject, runMigrations } from '../src';
import type { MigrationChain } from '../src';

describe('runMigrations', () => {
  const chain: MigrationChain = {
    current: 3,
    steps: {
      1: (doc) => ({ ...doc, title: doc.name, name: undefined }),
      2: (doc) => ({ ...doc, tags: [] }),
    },
  };

  it('applies every step from the stored version to the current one', () => {
    const result = runMigrations({ schemaVersion: 1, name: 'x' }, chain);
    expect(result).toEqual({
      ok: true,
      from: 1,
      value: { schemaVersion: 3, title: 'x', name: undefined, tags: [] },
    });
  });

  it('leaves current documents untouched and does not mutate the input', () => {
    const input = { schemaVersion: 3, title: 'y' };
    const result = runMigrations(input, chain);
    expect(result).toEqual({ ok: true, from: 3, value: input });
    expect(result.ok && result.value).not.toBe(input);
  });

  it('refuses documents from a newer app version', () => {
    const result = runMigrations({ schemaVersion: 4 }, chain);
    expect(result.ok).toBe(false);
  });

  it('refuses a gap in the chain', () => {
    const gappy: MigrationChain = { current: 3, steps: { 1: (d) => d } };
    expect(runMigrations({ schemaVersion: 1 }, gappy).ok).toBe(false);
  });

  it.each([null, [], 'x', 1, {}, { schemaVersion: 0 }, { schemaVersion: 1.5 }])(
    'rejects %j',
    (raw) => {
      expect(runMigrations(raw, chain).ok).toBe(false);
    },
  );
});

describe('project defaults', () => {
  const now = '2026-09-24T10:00:00.000Z';

  it.each(['A4', 'A5'] as const)('a new %s project is valid at the current version', (format) => {
    const project = createProject({ id: 'p1', name: 'Test', format, locale: 'pl', now });
    expect(project.schemaVersion).toBe(PROJECT_MIGRATIONS.current);
    expect(parseProject(project).ok).toBe(true);
  });

  it('uses ring-binding home-print defaults', () => {
    const a4 = createProject({ id: 'a', name: 'A', format: 'A4', locale: 'en', now });
    const a5 = createProject({ id: 'b', name: 'B', format: 'A5', locale: 'en', now });
    expect(a4.print.profile).toBe('home-duplex');
    expect(a5.print.profile).toBe('home-a5-2up');
    for (const p of [a4, a5]) {
      expect(p.print.binding.kind).toBe('ring');
      expect(p.print.bleed).toBe(0);
      expect(p.print.margins.inner).toBeGreaterThanOrEqual(18);
      expect(p.generation.dailyLayout).toBe('spread');
      expect(p.generation.quoteCadence).toBe('daily');
    }
  });

  it('centres ISO 838 holes 80 mm apart on the binding edge', () => {
    const a4 = createProject({ id: 'a', name: 'A', format: 'A4', locale: 'en', now });
    const binding = a4.print.binding;
    expect(binding.kind === 'ring' && binding.holePositions).toEqual([108.5, 188.5]);
  });
});
