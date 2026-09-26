import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeTemplate, weeklyPlannerTemplate } from './template';

// Regenerates template.json from src/template.ts. The test fails if they drift apart.
const out = fileURLToPath(new URL('../template.json', import.meta.url));
writeFileSync(out, serializeTemplate(weeklyPlannerTemplate));
console.log(`Wrote ${out}`);
