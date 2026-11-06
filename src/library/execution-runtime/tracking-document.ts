import type { ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionAssignment, ExecutionRun } from '../coordination-store/execution-types.js';
import type { DirectorResult } from '../task-intake/direction.js';
import { RepositoryDocuments } from '../operations/repository-documents.js';

/** Formats initial tracking intent using captured direction and the repository's authored template. */
export function trackingDocument(
  context: ProjectExecution,
  run: ExecutionRun,
  assignment?: ExecutionAssignment,
) {
  const direction = (run.data.initialDirection ?? run.data.direction) as DirectorResult | undefined;
  const objective = assignment?.objective ?? run.objective;
  const criteria =
    assignment?.acceptance ??
    direction?.assignments.flatMap((item) => item.acceptanceCriteria) ??
    [];
  const scopes = assignment
    ? [assignment.objective]
    : (direction?.assignments.map((item) => `${item.ownerId}: ${item.objective}`) ?? [objective]);
  return new RepositoryDocuments(context.source, context.base).prepare('issue', objective, {
    Summary: objective,
    Scope: scopes.map((scope) => '- ' + scope).join('\n'),
    'Acceptance criteria': criteria.length
      ? [...new Set(criteria)].map((criterion) => '- [ ] ' + criterion).join('\n')
      : 'Acceptance criteria are not yet retained; this issue does not establish completed work.',
    'Verification and current status': [
      'Tracking created before engineering. Verification and integration remain pending.',
      `Environment: ${run.environment?.mode ?? 'unspecified'}. Run: \`${run.id}\`.`,
      ...(assignment
        ? [`Accountable owner: ${assignment.owner}. Assignment: \`${assignment.id}\`.`]
        : []),
    ].join('\n\n'),
  });
}
