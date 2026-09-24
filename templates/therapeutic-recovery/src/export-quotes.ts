import { exportItemsCsv } from '@planner/content';
import { parseContentLibrary } from '@planner/schema';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Writes content/quotes.json as a spreadsheet (UTF-8 CSV that Excel opens correctly).
// Usage: pnpm --filter @planner/template-therapeutic-recovery quotes:export <file.csv>
const target = process.argv[2];
if (!target) {
  console.error('Usage: quotes:export <file.csv>');
  process.exit(1);
}
const source = fileURLToPath(new URL('../content/quotes.json', import.meta.url));
const library = parseContentLibrary(JSON.parse(readFileSync(source, 'utf8')));
if (!library.ok) throw new Error('content/quotes.json is invalid');
const out = resolve(process.env.INIT_CWD ?? process.cwd(), target);
writeFileSync(out, exportItemsCsv(library.value.items));
console.log(`Wrote ${library.value.items.length} quotes to ${out}`);
