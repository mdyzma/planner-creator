/**
 * Undo/redo over immutable snapshots (§9.2). Commands never mutate, so consecutive snapshots
 * share everything they did not change and 200 steps stay cheap.
 */

export const HISTORY_LIMIT = 200;

/** Edits with the same merge key within this window become one undo step (e.g. typing). */
export const MERGE_WINDOW_MS = 1500;

export interface HistoryEntry<T> {
  value: T;
  label: string;
}

export interface History<T> {
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
  /** Merge key and time of the last recorded edit. */
  last?: { mergeKey: string; at: number };
}

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

/**
 * Records that `before` was replaced by a new value. An edit with the same `mergeKey` as the
 * previous one, soon after it, extends that step instead of adding one.
 */
export function record<T>(
  history: History<T>,
  before: T,
  label: string,
  options: { mergeKey?: string; now?: number } = {},
): History<T> {
  const now = options.now ?? Date.now();
  const merges =
    options.mergeKey !== undefined &&
    history.last?.mergeKey === options.mergeKey &&
    now - history.last.at <= MERGE_WINDOW_MS &&
    history.past.length > 0;
  const last = options.mergeKey !== undefined ? { mergeKey: options.mergeKey, at: now } : undefined;
  if (merges) return { past: history.past, future: [], ...(last ? { last } : {}) };
  const past = [...history.past, { value: before, label }].slice(-HISTORY_LIMIT);
  return { past, future: [], ...(last ? { last } : {}) };
}

/** Steps back: returns the previous value and the history with `current` on the redo stack. */
export function undo<T>(
  history: History<T>,
  current: T,
): { history: History<T>; value: T; label: string } | undefined {
  const entry = history.past.at(-1);
  if (!entry) return undefined;
  return {
    value: entry.value,
    label: entry.label,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, { value: current, label: entry.label }],
    },
  };
}

export function redo<T>(
  history: History<T>,
  current: T,
): { history: History<T>; value: T; label: string } | undefined {
  const entry = history.future.at(-1);
  if (!entry) return undefined;
  return {
    value: entry.value,
    label: entry.label,
    history: {
      past: [...history.past, { value: current, label: entry.label }],
      future: history.future.slice(0, -1),
    },
  };
}
