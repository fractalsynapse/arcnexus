import { existsSync } from 'node:fs';
import type { Plan } from '../../direction/src/index.js';
import type { ActivityCheckpoint, ActivityRepair } from '../../workflow/src/index.js';
import { checkCommand, type CheckResult } from './check.js';
import type { HostTask } from './index.js';
import { pendingStewardCheck, type StewardScope } from './steward-check.js';

interface Event {
  plan?: Plan;
  position?: { completed: number; activities: Readonly<Record<string, number>> };
  repair?: ActivityRepair;
  activation?: ActivityCheckpoint;
  baseRevision?: string;
  check?: CheckResult;
  scope?: StewardScope;
}

/** Expose prior red only for the same accepted milestone after completed Implementation and a rewind. */
export function retainedTesting(task: HostTask, scope: StewardScope, id?: string) {
  if (scope.activity !== 'testing') return;
  const events = task.observations<Event>();
  const current = events.findLast(({ plan }) => plan)?.plan;
  const position = events.findLast(({ position }) => position)?.position;
  const milestone = current?.milestones[position?.completed ?? 0];
  if (!milestone || milestone.owner !== scope.owner) return;
  const repair = events.findLast(({ repair }) => repair?.milestone === milestone.id)?.repair;
  const completed = implemented(events, milestone.id, scope.owner, id);
  if (!repair || completed < 0 || position?.activities[milestone.id] !== 1) return;
  const earlier = events.slice(0, completed);
  const red = earlier.findLastIndex(
    (event, index) =>
      Boolean(event.check) &&
      matchingRed(task, event, earlier.slice(0, index), scope, milestone, id),
  );
  if (red < 0) return;
  const check = earlier[red]!.check!;
  return completedRed(earlier.slice(red + 1), events[completed]!.activation!, check);
}

/** Bind the negative observation to original acceptance, captured authority and the actual command. */
function matchingRed(
  task: HostTask,
  event: Event,
  before: Event[],
  scope: StewardScope,
  milestone: Plan['milestones'][number],
  id?: string,
) {
  if (!negativeCheck(event, scope, id)) return false;
  const check = event.check!;
  if (!sameAuthority(task, before, milestone)) return false;
  try {
    const command = checkCommand(task.capture, task.worktree!, check.id, scope.owner);
    return (
      command.executable === check.command &&
      JSON.stringify(command.args) === JSON.stringify(check.args)
    );
  } catch {
    return false;
  }
}

/** Correct only a repeated-red request after a passing result; required passing failures remain immutable. */
export function repairTestingExpectation(task: HostTask, id: string, scope: StewardScope) {
  const pending = pendingStewardCheck(task.observations(), scope, id);
  if (!pending || pending.id !== id || pending.expected === scope.expected) return;
  const proof =
    scope.expected === 'pass' && pending.expected === 'fail' && pending.status === 0
      ? retainedTesting(task, scope, id)
      : undefined;
  if (!proof)
    throw new Error(`Cannot change the required recheck for ${id}: expected ${pending.expected}`);
  task.note({ checkExpectationRepair: { scope, log: pending.log, ...proof } });
}

/** Require the same goal acceptance and captured architecture as the original negative observation. */
function sameAuthority(task: HostTask, before: Event[], milestone: Plan['milestones'][number]) {
  const base = before.findLast(({ baseRevision }) => baseRevision)?.baseRevision;
  if (!base || base !== task.capture.source.revision) return false;
  const original = before
    .findLast(({ plan }) => plan)
    ?.plan?.milestones.find(({ id }) => id === milestone.id);
  return (
    original?.owner === milestone.owner &&
    JSON.stringify(original.criteria) === JSON.stringify(milestone.criteria)
  );
}

/** Locate actual completed Implementation, rather than infer it from a repaired cursor. */
function implemented(events: Event[], milestone: string, owner: string, id?: string) {
  const passed = new Set(
    events.flatMap(({ check, scope }) =>
      scope?.owner === owner &&
      scope.activity === 'implementation' &&
      scope.expected === 'pass' &&
      check?.status === 0 &&
      !check.prerequisite &&
      (!id || check.id === id) &&
      existsSync(check.log)
        ? [check.log]
        : [],
    ),
  );
  return events.findLastIndex(
    ({ activation }) =>
      activation?.milestone === milestone &&
      activation.owner === owner &&
      activation.step === 'implementation' &&
      activation.outcome.kind === 'completed' &&
      activation.outcome.evidence.some((log) => passed.has(log)),
  );
}

/** Associate actual initial red with the completed Testing activation that supplied it. */
function completedRed(events: Event[], implementation: ActivityCheckpoint, check: CheckResult) {
  const { milestone, owner } = implementation;
  const green = implementationGreen(events, implementation, check);
  const tested = events.some(
    ({ activation }) =>
      activation?.milestone === milestone &&
      activation.owner === owner &&
      activation.step === 'testing' &&
      activation.outcome.kind === 'completed' &&
      activation.outcome.evidence.includes(check.log),
  );
  return tested && green
    ? {
        milestone,
        id: check.id,
        redLog: check.log,
        greenLog: green.log,
        completedImplementation: true,
      }
    : undefined;
}

/** Require the completed Implementation receipt to cite a matching actual passing operation. */
function implementationGreen(
  events: Event[],
  implementation: ActivityCheckpoint,
  check: CheckResult,
) {
  return events.findLast(
    ({ check: result, scope }) =>
      scope?.owner === implementation.owner &&
      scope.activity === 'implementation' &&
      scope.expected === 'pass' &&
      result?.id === check.id &&
      result.status === 0 &&
      !result.prerequisite &&
      result.command === check.command &&
      JSON.stringify(result.args) === JSON.stringify(check.args) &&
      existsSync(result.log) &&
      implementation.outcome.evidence.includes(result.log),
  )?.check;
}

/** Exclude unavailable prerequisites, missing logs and another operation or owner's observations. */
function negativeCheck(event: Event, scope: StewardScope, id?: string) {
  const check = event.check;
  return (
    check &&
    !check.prerequisite &&
    typeof check.status === 'number' &&
    check.status > 0 &&
    event.scope?.owner === scope.owner &&
    event.scope.activity === 'testing' &&
    event.scope.expected === 'fail' &&
    (!id || check.id === id) &&
    existsSync(check.log)
  );
}
