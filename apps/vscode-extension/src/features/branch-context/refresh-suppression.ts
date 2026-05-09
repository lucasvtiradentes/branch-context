import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const SUPPRESSION_BACKSTOP_MS = 10_000;

type TimeoutHandle = ReturnType<typeof setTimeout>;

type SuppressionEntry = {
  count: number;
  timers: Set<TimeoutHandle>;
};

const suppressions = new Map<string, SuppressionEntry>();

export function suppressNextBranchContextRefresh(filePath: string): void {
  const key = canonicalizePath(filePath);
  let entry = suppressions.get(key);
  if (!entry) {
    entry = { count: 0, timers: new Set() };
    suppressions.set(key, entry);
  }

  entry.count += 1;
  const timer = setTimeout(() => {
    const current = suppressions.get(key);
    if (!current) {
      return;
    }

    current.timers.delete(timer);
    decrementSuppression(key, current);
  }, SUPPRESSION_BACKSTOP_MS);
  entry.timers.add(timer);
}

export function consumeBranchContextRefreshSuppression(filePath: string): boolean {
  const key = canonicalizePath(filePath);
  const entry = suppressions.get(key);
  if (!entry || entry.count === 0) {
    return false;
  }

  const [timer] = entry.timers;
  if (timer) {
    clearTimeout(timer);
    entry.timers.delete(timer);
  }
  decrementSuppression(key, entry);
  return true;
}

function decrementSuppression(key: string, entry: SuppressionEntry): void {
  entry.count -= 1;
  if (entry.count <= 0) {
    for (const timer of entry.timers) {
      clearTimeout(timer);
    }
    suppressions.delete(key);
  }
}

function canonicalizePath(filePath: string): string {
  try {
    return realpathSync.native(filePath);
  } catch {
    return resolve(filePath);
  }
}
