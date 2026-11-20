import { createHash } from 'node:crypto';
import type { Milestone } from '../../direction/src/index.js';
import type { HostTask } from './index.js';
import type { CheckResult } from './check.js';
import { correctionFinding } from './correction.js';
import { git, gitSource } from './git.js';
import { checkFailureSignature, correctionMadeProgress } from './steward-check.js';

/** Identify only committed paths named by accepted work or observed check selection. */
export function holdInputPaths(task: HostTask, milestone: Milestone, check?: CheckResult) {
  const finding = correctionFinding(task.history(), milestone);
  const terms = new Set(
    JSON.stringify([finding, milestone.criteria, milestone.steps, check?.args])
      .split(/[^a-zA-Z0-9_./-]+/)
      .filter(Boolean),
  );
  const paths = git(task.worktree!, 'ls-tree', '-r', '--name-only', '-z', 'HEAD')
    .split('\0')
    .filter(Boolean);
  const selected = new Set(check?.selection?.files ?? []);
  return paths.filter((path) => terms.has(path) || selected.has(path)).sort();
}

/** Compare the same failure against relevant checked edits, preserving ordinary caller recovery. */
export function checkedCorrectionProgress(
  task: HostTask,
  milestone: Milestone,
  previous: string,
  current: string,
) {
  const finding = correctionFinding(task.history(), milestone);
  if (finding?.kind !== 'rejection') return correctionMadeProgress(task.observations(), previous);
  if (checkFailureSignature(previous) !== checkFailureSignature(current)) return true;
  const paths = holdInputPaths(task, milestone);
  return correctionMadeProgress(task.observations(), previous, paths);
}

/** Bind comparison to secured bytes and diagnostic content, never artifact allocation or model claims. */
export function holdProgress(
  task: HostTask,
  milestone: Milestone,
  diagnostic: string,
  check?: CheckResult,
) {
  const inputs = holdInputPaths(task, milestone, check).map((path) => ({
    path,
    digest: createHash('sha256')
      .update(gitSource(task.worktree!, 'HEAD', path))
      .digest('hex'),
  }));
  const failure = check ? checkFailureSignature(check.log) : diagnostic;
  const identity = createHash('sha256')
    .update(JSON.stringify([milestone.criteria, inputs, failure]))
    .digest('hex');
  return { identity, inputs };
}
