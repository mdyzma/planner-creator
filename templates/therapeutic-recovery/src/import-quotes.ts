import { importItemsCsv, validateItems } from '@planner/content';
import type { ContentLibrary } from '@planner/schema';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Replaces content/quotes.json with the quotes in a spreadsheet, after strict checks: both
// languages, length, a shippable licence (original or public-domain), no duplicate ids.
// Usage: pnpm --filter @planner/template-therapeutic-recovery quotes:import <file.csv>
const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error('Usage: quotes:import <file.csv>');
  process.exit(1);
}
const source = resolve(process.env.INIT_CWD ?? process.cwd(), sourceArg);
const { items, errors } = importItemsCsv(readFileSync(source, 'utf8'), {
  defaultKind: 'quote',
  idPrefix: 'q-',
});
for (const e of errors) console.error(`Line ${e.line}: ${e.message}`);

const issues = validateItems(items, { forShipping: true });
for (const i of issues) {
  const where = [i.itemId, i.locale, i.otherId && `same as ${i.otherId}`].filter(Boolean).join(' ');
  console[i.severity === 'error' ? 'error' : 'warn'](
    `${i.severity.toUpperCase()} ${where}: ${i.code}`,
  );
}
if (errors.length > 0 || issues.some((i) => i.severity === 'error')) {
  console.error('Nothing written: fix the errors above and import again.');
  process.exit(1);
}

const library: ContentLibrary = { schemaVersion: 1, library: 'quotes', items };
const target = fileURLToPath(new URL('../content/quotes.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(library, null, 2)}\n`);
console.log(`Wrote ${items.length} quotes to ${target}`);
