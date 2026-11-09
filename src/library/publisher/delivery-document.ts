import { RepositoryDocuments } from '../operations/repository-documents.js';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import type { DeliveryCapture } from '../coordination-store/delivery-types.js';
import type { RecordData } from '../workspace/state.js';

/** Captures human review content with verified delivery facts before either provider receives it. */
export function deliveryDocument(
  run: ExecutionRun,
  assignments: ExecutionAssignment[],
  candidate: RecordData,
  verification: DeliveryCapture['verification'],
  head: string,
) {
  const issue = run.data.trackingIssue as { issueId?: unknown; url?: unknown } | undefined;
  const revision = String(run.data.authorityBase ?? candidate.base);
  return new RepositoryDocuments(candidate.source, revision).prepare(
    'pull-request',
    run.objective,
    {
      Summary: run.objective,
      Changes:
        assignments
          .map((assignment) => `- ${assignment.owner}: ${assignment.objective}`)
          .join('\n') || 'Verified delivery of the retained assembled candidate.',
      Verification: verificationSummary(run, head, verification),
      'Related issue': issue?.issueId
        ? run.environment?.mode === 'live'
          ? `Part of #${String(issue.issueId)}`
          : `Simulated tracking issue: \`${String(issue.issueId)}\`.`
        : 'No target issue reference is retained; review before integration.',
      'Risks and remaining work':
        'This delivery requests staging integration only. It does not authorize main integration, real tags, or package publication. Provider checks and review must pass for the unchanged head.',
    },
  );
}

/** Separates observed engineering evidence from provider gates that have not yet run. */
function verificationSummary(
  run: ExecutionRun,
  head: string,
  verification: DeliveryCapture['verification'],
) {
  return [
    `Candidate: \`${head}\`.`,
    `Independent verification retained with digest \`${verification.digest}\`.`,
    `Environment: ${run.environment?.mode ?? 'unspecified'}. Provider CI and review remain separate integration gates.`,
    'Retained evidence references (application storage):\n' +
      verification.references.map((ref) => '- `' + ref + '`').join('\n'),
  ].join('\n\n');
}
