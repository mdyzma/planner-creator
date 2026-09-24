import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Messages = { [key: string]: string | Messages };

const load = (locale: string): Messages =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../messages/${locale}.json`, import.meta.url)), 'utf8'),
  );

const flatten = (m: Messages, prefix = ''): Record<string, string> =>
  Object.fromEntries(
    Object.entries(m).flatMap(([k, v]) =>
      typeof v === 'string' ? [[`${prefix}${k}`, v]] : Object.entries(flatten(v, `${prefix}${k}.`)),
    ),
  );

const en = flatten(load('en'));
const pl = flatten(load('pl'));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

describe('interface messages', () => {
  it('have the same keys in English and Polish', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of Object.entries({ ...en, ...pl }))
      expect(value.trim(), key).not.toBe('');
  });

  it('use the same placeholders and rich-text tags in both languages', () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(pl[key]!), key).toEqual(placeholders(en[key]!));
      expect(tags(pl[key]!), key).toEqual(tags(en[key]!));
    }
  });

  it('give Polish plurals the one/few/many forms', () => {
    for (const [key, value] of Object.entries(pl)) {
      if (value.includes(', plural,')) {
        for (const form of ['one {', 'few {', 'many {', 'other {'])
          expect(value, key).toContain(form);
      }
    }
  });
});
