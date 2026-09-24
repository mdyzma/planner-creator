import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';
import type { PrintProfile } from '@planner/schema';
import { PrintProfile as PrintProfileSchema, parseProjectJson } from '@planner/schema';
import { exportPlanner } from './pipeline';
import { createRenderer } from './render';

const USAGE = `Exports a planner (a JSON file saved from the app) to PDF.

  pnpm --filter @planner/export-node pdf <planner.json> [options]

Options:
  --out <file.pdf>      output file (default: next to the JSON)
  --profile <profile>   home-duplex | home-manual-duplex | home-a5-2up | home-a5-native | print-shop
                        (default: the planner's print setting)
  --section <key>       print one section only, e.g. month:2026-11
  --web-url <url>       render from a running web app instead of apps/web/out
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    profile: { type: 'string' },
    section: { type: 'string' },
    'web-url': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const input = positionals[0];
if (values.help || !input) {
  console.log(USAGE);
  process.exit(input ? 0 : 1);
}

const parsed = parseProjectJson(await readFile(input, 'utf8'));
if (!parsed.ok) {
  console.error(`${input} is not a valid planner:`);
  for (const issue of parsed.issues.slice(0, 10))
    console.error(`  ${issue.path}: ${issue.message}`);
  process.exit(1);
}

let profile: PrintProfile | undefined;
if (values.profile) {
  const p = PrintProfileSchema.safeParse(values.profile);
  if (!p.success) {
    console.error(`Unknown profile ${values.profile}.\n\n${USAGE}`);
    process.exit(1);
  }
  profile = p.data;
}

const stem = (values.out ?? input).replace(new RegExp(`${extname(values.out ?? input)}$`), '');
const renderer = await createRenderer({ webUrl: values['web-url'] });
try {
  const started = Date.now();
  const files = await exportPlanner(renderer, parsed.value, {
    profile,
    section: values.section,
    onProgress: (done, total) => process.stdout.write(`\rRendering ${done}/${total}`),
  });
  process.stdout.write('\n');
  for (const file of files) {
    const path = `${stem}${file.suffix}.pdf`;
    await writeFile(path, file.bytes);
    console.log(`${basename(path)}: ${file.pageCount} pages`);
  }
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
} finally {
  await renderer.close();
}
