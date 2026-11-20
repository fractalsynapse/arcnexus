import { createHash } from 'node:crypto';
import type { Capture } from '../../architecture/src/index.js';
import type { CheckResult } from './check.js';
import type { StewardScope } from './steward-check.js';
import { git } from './git.js';
import type { HostTask } from './index.js';

interface Event {
  editIntent?: unknown;
  architectureWrite?: unknown;
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
  const lastEdit = events.findLastIndex(
    ({ editIntent, edits, architectureWrite }) => editIntent || edits || architectureWrite,
  );
  const unique = new Map<string, OwnerObservation>();
  for (const [index, { check, scope }] of events.entries()) {
    if (!check || !scope) continue;
    const afterLastEdit = index > lastEdit;
    const key = JSON.stringify([scope, check.id, check.status, check.diagnostic, afterLastEdit]);
    const operation = operations?.[check.id];
    const source = candidate && afterLastEdit && operation ? { candidate, operation } : {};
    unique.delete(key);
    unique.set(key, { scope, check, afterLastEdit, ...source });
  }
  return [...unique.values()];
}

/** Hash review-relevant owner facts without log filenames, durations or workspace paths. */
export function ownerEvidenceDigest(observations: readonly OwnerObservation[], tree: string) {
  const facts = observations
    .filter(({ candidate }) => candidate?.tree === tree)
    .map(({ scope, check, candidate, operation }) =>
      JSON.stringify([
        scope,
        check.id,
        check.command,
        check.args,
        check.status,
        check.diagnostic,
        check.selection,
        candidate,
        operation,
      ]),
    );
  if (facts.length) return createHash('sha256').update(JSON.stringify(facts.sort())).digest('hex');
}

/** Identify a checkpoint only while the native worktree still matches it. */
export function cleanCandidate({ worktree, branch, capture }: HostTask) {
  if (worktree && branch && !git(worktree, 'status', '--porcelain'))
    return { tree: git(worktree, 'rev-parse', 'HEAD^{tree}'), base: capture.source.revision };
}
