import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALES, parseContentLibrary } from '../src';

const contentDir = fileURLToPath(
  new URL('../../../templates/therapeutic-recovery/content', import.meta.url),
);
const files = readdirSync(contentDir).filter((f) => f.endsWith('.json'));

describe.each(files)('templates/therapeutic-recovery/content/%s', (file) => {
  const raw: unknown = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
  const result = parseContentLibrary(raw);

  it('matches the content library schema', () => {
    if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
  });

  it('has unique ids, both languages, and only shippable licences', () => {
    if (!result.ok) return;
    const ids = result.value.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of result.value.items) {
      for (const locale of LOCALES)
        expect(item.text[locale]?.trim(), `${item.id}.${locale}`).toBeTruthy();
      expect(['original', 'public-domain']).toContain(item.license);
    }
  });
});
