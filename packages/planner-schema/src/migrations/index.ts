/**
 * Forward-only schema migrations (§4.8). Every persisted document carries `schemaVersion`;
 * loading always runs migrate → validate. `steps[n]` upgrades a document from version n to n + 1.
 */
export type JsonObject = Record<string, unknown>;
export type Migration = (doc: JsonObject) => JsonObject;

export interface MigrationChain {
  readonly current: number;
  readonly steps: Readonly<Record<number, Migration>>;
}

export type MigrationResult =
  { ok: true; value: JsonObject; from: number } | { ok: false; error: string };

export function runMigrations(raw: unknown, chain: MigrationChain): MigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Expected a JSON object.' };
  }
  const from = (raw as JsonObject).schemaVersion;
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) {
    return { ok: false, error: 'Missing or invalid schemaVersion.' };
  }
  if (from > chain.current) {
    return {
      ok: false,
      error: `Document schemaVersion ${from} is newer than this app supports (${chain.current}). Update the app.`,
    };
  }
  let doc: JsonObject = structuredClone(raw as JsonObject);
  for (let v = from; v < chain.current; v++) {
    const step = chain.steps[v];
    if (!step) return { ok: false, error: `No migration from schemaVersion ${v}.` };
    doc = { ...step(doc), schemaVersion: v + 1 };
  }
  return { ok: true, value: doc, from };
}

/** Version 1 is the first published schema; add steps here when a shape changes. */
export const PROJECT_MIGRATIONS: MigrationChain = { current: 1, steps: {} };
export const TEMPLATE_MIGRATIONS: MigrationChain = { current: 1, steps: {} };
export const CONTENT_MIGRATIONS: MigrationChain = { current: 1, steps: {} };
