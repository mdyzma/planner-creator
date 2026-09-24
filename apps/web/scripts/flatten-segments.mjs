// After `next build`: Next.js' static export writes route segment prefetch data in nested folders
// (en/export/__next.$d$locale/export/__PAGE__.txt) but the client requests dotted file names
// (en/export/__next.$d$locale.export.__PAGE__.txt). Copy each file to the dotted name so link
// prefetches find it instead of returning 404 on the static host.
import { copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../out', import.meta.url));

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let copied = 0;
for (const file of files(out)) {
  const parts = relative(out, file).split(sep);
  const at = parts.findIndex((p, i) => p.startsWith('__next.') && i < parts.length - 1);
  if (at < 0) continue;
  const flat = join(out, ...parts.slice(0, at), parts.slice(at).join('.'));
  copyFileSync(file, flat);
  copied++;
}
console.log(`flatten-segments: ${copied} prefetch files`);
