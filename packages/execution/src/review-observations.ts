import type { Capture } from '../../architecture/src/index.js';
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
  candidate?: { tree: string; base: string };
  operation?: Capture['operations'][string];
}

/** Collect exact host evidence and flag observations that follow the last checked edit. */
export function ownerReviewObservations(
  events: readonly Event[],
  candidate?: OwnerObservation['candidate'],
  operations?: Capture['operations'],
): OwnerObservation[] {
  const lastEdit = events.findLastIndex(({ editIntent, edits }) => editIntent || edits);
  const unique = new Map<string, OwnerObservation>();
  for (const [index, { check, scope }] of events.entries()) {
    if (!check || !scope) continue;
    const afterLastEdit = index > lastEdit;
    const key = JSON.stringify([scope, check.id, check.status, afterLastEdit]);
    const operation = operations?.[check.id];
    const source = candidate && afterLastEdit && operation ? { candidate, operation } : {};
    unique.delete(key);
    unique.set(key, { scope, check, afterLastEdit, ...source });
  }
  return [...unique.values()];
}
