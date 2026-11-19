import type { Plan, StewardCheckFailure } from '../../direction/src/index.js';
import type { CheckResult } from './check.js';
import type { HostTask } from './index.js';
import { checkFailureSignature, type StewardScope } from './steward-check.js';

interface Event {
  plan?: Plan;
  position?: { completed: number };
  baseRevision?: string;
  check?: CheckResult;
  scope?: StewardScope;
}

/** Recognize established Testing red without treating a new defect as a satisfied negative test. */
export function establishedTestingRed(
  task: HostTask,
  scope: StewardScope,
  pending: StewardCheckFailure,
) {
  if (scope.activity !== 'testing' || pending.status <= 0) return;
  const events = task.observations<Event>();
  const index = events.findLastIndex(({ check }) => check?.log === pending.log);
  const current = events[index]?.check;
  if (!current || current.prerequisite) return;
  const boundary = testingBoundary(events.slice(0, index), scope.owner);
  if (!boundary || boundary !== testingBoundary(events, scope.owner)) return;
  for (let at = index - 1; at >= 0; at--) {
    const event = events[at]!;
    if (!matchingCommand(event, current, scope.owner)) continue;
    if (testingBoundary(events.slice(0, at), scope.owner) !== boundary) continue;
    try {
      if (checkFailureSignature(event.check!.log) === checkFailureSignature(current.log))
        return event.check!.log;
    } catch {
      // Missing immutable evidence cannot authorize a classification change.
    }
  }
}

/** Match the actual command and failing exit, excluding dependency setup and other callers. */
function matchingCommand(event: Event, current: CheckResult, owner: string) {
  const { check, scope } = event;
  return (
    check &&
    !check.prerequisite &&
    scope?.owner === owner &&
    scope.activity === 'testing' &&
    scope.expected === 'fail' &&
    check.id === current.id &&
    check.status === current.status &&
    check.command === current.command &&
    JSON.stringify(check.args) === JSON.stringify(current.args)
  );
}

/** Bind observations to accepted identity, acceptance and captured authority, ignoring cursor rewinds. */
function testingBoundary(events: readonly Event[], owner: string) {
  const plan = events.findLast(({ plan }) => plan)?.plan;
  const position = events.findLast(({ position }) => position)?.position;
  const milestone = plan?.milestones[position?.completed ?? 0];
  const base = events.findLast(({ baseRevision }) => baseRevision)?.baseRevision;
  if (!milestone || milestone.owner !== owner || !base) return;
  return JSON.stringify([base, milestone.id, milestone.owner, milestone.criteria]);
}
