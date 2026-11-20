import { accessSync, constants, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Architecture,
  validateCapture,
  type ArchitectureProposal,
  type Capture,
} from '../../architecture/src/index.js';
import { team } from '../../team/src/index.js';
import type { Plan } from '../../direction/src/index.js';
import { approvedArchitecture, applyArchitecture } from './architecture-edits.js';
import { checkCommand, checkEnvironment } from './check.js';
import { git, gitSource } from './git.js';
import { isNativeGuidance, isTargetCodexConfig } from './host-config.js';
import type { HostTask } from './index.js';

interface Adoption {
  architectureAdoption?: { id: string; before: string; revision: string; receipt: string };
  architecturePending?: { id: string; head: string; diagnostic: string };
}

/** Apply exact approved guides and adopt a coherent committed architecture only between activities. */
export async function refreshArchitecture(
  task: HostTask,
  id: string,
  signal: AbortSignal,
  required = true,
) {
  const { proposal, receipt } = approvedArchitecture(task, id);
  if (!task.worktree) throw new Error('Architecture adoption requires its prepared worktree');
  validateAuthority(task, proposal);
  await applyArchitecture(task, id, signal);
  const head = git(task.worktree, 'rev-parse', 'HEAD');
  const prior = task
    .observations<Adoption>()
    .findLast((event) => event.architectureAdoption?.id === id)?.architectureAdoption;
  const revision = prior?.revision ?? head;
  const capture = new Architecture().capture(task.config.capture.source.root, revision);
  validateAuthority(task, proposal, capture);
  validateRetainedWork(task, capture);
  try {
    validateCapture(capture);
    validateAvailability(capture, task.worktree);
  } catch (error) {
    return pending(task, id, head, error, required);
  }
  return adoptCapture(task, capture, id, receipt, prior);
}

/** Persist the approved transition before switching the next request, while making recorded replay idempotent. */
function adoptCapture(
  task: HostTask,
  capture: Capture,
  id: string,
  receipt: string,
  prior: Adoption['architectureAdoption'],
) {
  if (task.capture.source.revision === capture.source.revision) return true;
  if (!prior)
    task.note({
      architectureAdoption: {
        id,
        before: task.capture.source.revision,
        revision: capture.source.revision,
        receipt,
        runtime: {
          executable: process.execPath,
          entrypoint: process.argv[1],
          node: process.version,
        },
      },
    });
  task.capture = capture;
  return true;
}

/** Preserve an exact prerequisite diagnostic without letting an unavailable declaration become authority. */
function pending(task: HostTask, id: string, head: string, error: unknown, required: boolean) {
  const diagnostic = error instanceof Error ? error.message : String(error);
  const prior = task
    .observations<Adoption>()
    .findLast((event) => event.architecturePending)?.architecturePending;
  if (!prior || prior.id !== id || prior.head !== head || prior.diagnostic !== diagnostic)
    task.note({ architecturePending: { id, head, diagnostic } });
  if (required)
    throw new Error(`Architecture prerequisite unavailable: ${diagnostic}`, { cause: error });
  return false;
}

/** Check executable availability in the actual confined environment; full behavioral acceptance remains mandatory. */
function validateAvailability(capture: Capture, worktree: string) {
  for (const component of team.list(capture.components)) {
    for (const [activity, mapping] of Object.entries(component.activities)) {
      for (const binding of mapping.operations) {
        const id = typeof binding === 'string' ? binding : binding.operation;
        if (!capture.operations[id]?.command) continue;
        const command = checkCommand(capture, worktree, id, component.id, activity);
        const executable = command.executable.includes('/')
          ? resolve(command.cwd, command.executable)
          : checkEnvironment.PATH.split(':')
              .map((path) => resolve(path, command.executable))
              .find(existsSync);
        if (!executable)
          throw new Error(`Unavailable operation executable: ${id} (${command.executable})`);
        accessSync(executable, constants.X_OK);
      }
    }
  }
}

/** Reject any authority mutation outside reviewed bytes, including candidate-added native instructions. */
function validateAuthority(task: HostTask, proposal: ArchitectureProposal, next?: Capture) {
  const before = task.config.capture;
  const changed = git(
    task.worktree!,
    'diff',
    '--name-only',
    '--no-renames',
    '-z',
    proposal.baseline,
    'HEAD',
    '--',
  )
    .split('\0')
    .filter(Boolean);
  const files = new Map(proposal.files.map((file) => [file.path, file]));
  for (const path of changed) {
    if (!authorityPath(before, path) && !(next && authorityPath(next, path))) continue;
    const file = files.get(path);
    if (!file) throw new Error(`Unapproved architecture or guidance change: ${path}`);
    const actual = git(task.worktree!, 'ls-tree', 'HEAD', '--', path)
      ? gitSource(task.worktree!, 'HEAD', path)
      : null;
    if (actual !== file.content) throw new Error(`Approved architecture contents changed: ${path}`);
  }
}

/** Identify authority from the captured definitions rather than treating ordinary implementation as permission. */
function authorityPath(capture: Capture, path: string) {
  return (
    path.startsWith('.arc/architecture/') ||
    isNativeGuidance(path) ||
    isTargetCodexConfig(path) ||
    path === capture.project.contractRegistry ||
    path === capture.project.planTemplate ||
    capture.contracts.some((contract) => contract.file === path) ||
    Object.values(capture.standards).some((standard) => standard.document === path)
  );
}

/** Revalidate the accepted pending activities and actual checked owners without reconstructing the plan. */
export function validateRetainedWork(task: HostTask, capture: Capture) {
  const events = task.history();
  const plan = events.findLast((event) => 'plan' in event)?.plan as Plan | undefined;
  const position = events.findLast((event) => 'position' in event)?.position;
  for (const milestone of plan?.milestones.slice(position?.completed ?? 0) ?? []) {
    for (const step of milestone.steps.slice(position?.activities[milestone.id] ?? 0)) {
      if (step.inapplicable || step.activity === 'release') continue;
      if (
        !team.list(capture.components, { component: milestone.owner, activity: step.activity })
          .length
      )
        throw new Error(
          `Accepted pending activity is unavailable: ${milestone.owner}/${step.activity}`,
        );
    }
  }
  const edits = task.observations<{ owner?: string; editIntent?: { path: string }[] }>();
  for (const event of edits) {
    for (const edit of event.editIntent ?? []) {
      const owner = team.ownerFor(team.list(capture.components), edit.path);
      if (owner.kind !== 'owned' || owner.owner.id !== event.owner)
        throw new Error(`Retained checked owner changed: ${edit.path} (${event.owner})`);
    }
  }
}
