import type { CheckResult } from './check.js';
import type { StewardScope } from './steward-check.js';

interface Event {
  editIntent?: unknown;
  edits?: unknown;
  check?: CheckResult;
  scope?: StewardScope;
}

export interface OwnerObservation {
  scope: StewardScope;
  check: CheckResult;
  afterLastEdit: boolean;
}

/** Collect exact host evidence and flag observations that follow the last checked edit. */
export function ownerReviewObservations(events: readonly Event[]): OwnerObservation[] {
  const lastEdit = events.findLastIndex(({ editIntent, edits }) => editIntent || edits);
  const unique = new Map<string, OwnerObservation>();
  for (const [index, { check, scope }] of events.entries()) {
    if (!check || !scope) continue;
    const afterLastEdit = index > lastEdit;
    const key = JSON.stringify([scope, check.id, check.status, afterLastEdit]);
    unique.set(key, { scope, check, afterLastEdit });
  }
  return [...unique.values()];
}
