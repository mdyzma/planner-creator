import type { FormatId, JsonPatchOp, PageTemplate } from '@planner/schema';

export interface PatchWarning {
  op: JsonPatchOp;
  reason: string;
}

/** RFC 6901 pointer → path segments ("/body/children/0" → ["body", "children", "0"]). */
function parsePointer(pointer: string): string[] | undefined {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) return undefined;
  return pointer
    .slice(1)
    .split('/')
    .map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'));
}

type Json = unknown;

function applyOp(doc: Json, segments: string[], op: JsonPatchOp): Json {
  const [head, ...rest] = segments;
  if (head === undefined) {
    if (op.op === 'remove') throw new Error('cannot remove the document root');
    return op.value;
  }
  const isLast = rest.length === 0;

  if (Array.isArray(doc)) {
    const index = head === '-' ? doc.length : Number(head);
    if (!Number.isInteger(index) || index < 0 || index > doc.length) {
      throw new Error(`index ${head} out of range`);
    }
    const copy = [...doc];
    if (isLast) {
      if (op.op === 'add') copy.splice(index, 0, op.value);
      else if (index >= doc.length) throw new Error(`no element at ${head}`);
      else if (op.op === 'remove') copy.splice(index, 1);
      else copy[index] = op.value;
      return copy;
    }
    if (index >= doc.length) throw new Error(`no element at ${head}`);
    copy[index] = applyOp(copy[index], rest, op);
    return copy;
  }

  if (typeof doc === 'object' && doc !== null) {
    const obj = doc as Record<string, Json>;
    if (isLast) {
      if (op.op !== 'add' && !(head in obj)) throw new Error(`no property ${head}`);
      if (op.op === 'remove') {
        const { [head]: _removed, ...kept } = obj;
        return kept;
      }
      return { ...obj, [head]: op.value };
    }
    if (!(head in obj)) throw new Error(`no property ${head}`);
    return { ...obj, [head]: applyOp(obj[head], rest, op) };
  }

  throw new Error(`cannot descend into ${typeof doc} at ${head}`);
}

/**
 * Applies add/remove/replace operations immutably. An operation that does not fit the document
 * is skipped and reported, so a stale override never breaks a whole planner.
 */
export function applyPatch<T>(
  doc: T,
  ops: readonly JsonPatchOp[],
): { value: T; warnings: PatchWarning[] } {
  const warnings: PatchWarning[] = [];
  let value: Json = doc;
  for (const op of ops) {
    const segments = parsePointer(op.path);
    if (!segments) {
      warnings.push({ op, reason: 'path must start with "/"' });
      continue;
    }
    try {
      value = applyOp(value, segments, op);
    } catch (e) {
      warnings.push({ op, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { value: value as T, warnings };
}

/** The page template as it prints in `format`: its per-format adjustments applied (§5.3). */
export function resolveTemplateForFormat(
  template: PageTemplate,
  format: FormatId,
): { template: PageTemplate; warnings: PatchWarning[] } {
  const ops = template.formatOverrides?.[format];
  if (!ops?.length) return { template, warnings: [] };
  const { value, warnings } = applyPatch(template, ops);
  return { template: value, warnings };
}
