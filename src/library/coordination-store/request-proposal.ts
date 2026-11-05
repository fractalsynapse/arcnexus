import type { ExecutionAssignment, OwnerRequest } from './execution-types.js';

/** Resolves dependency workflow inheritance once for admission and durable recipient creation. */
export function requestProposal(
  sender: ExecutionAssignment,
  request: Pick<OwnerRequest, 'kind' | 'changeType'>,
) {
  if (Object.hasOwn(request, 'allowedWritePaths'))
    throw new Error(
      'Inbox requests cannot prescribe writable files; describe required results instead',
    );
  const inherited = sender.data.proposal as Partial<OwnerRequest> | undefined;
  return {
    kind: request.kind ?? inherited?.kind ?? 'change',
    changeType: request.changeType ?? inherited?.changeType ?? 'behavior',
  };
}

/** Retains the strongest milestone when multiple requests deliberately share recipient work. */
export function requestMilestones(
  sender: ExecutionAssignment,
  recipient: string,
  request: OwnerRequest,
) {
  const existing = (sender.data.milestones ?? {}) as Record<string, string>;
  const required = request.milestone ?? 'delivered';
  return {
    ...existing,
    [recipient]: existing[recipient] === 'delivered' ? 'delivered' : required,
  };
}

/** Returns the precise mismatch without merging another assignment or modifying either party. */
export function sharedRequestProblem(
  recipient: ExecutionAssignment,
  request: Pick<OwnerRequest, 'owner' | 'objective' | 'acceptance' | 'kind' | 'changeType'>,
): string | undefined {
  const help = `Read assignment.evidence artifact=${recipient.id}:intent for the captured objective, acceptance and workflow. Use assignmentId=null for distinct bounded work.`;
  if (
    recipient.owner !== request.owner ||
    recipient.objective !== request.objective ||
    JSON.stringify(recipient.acceptance) !== JSON.stringify(request.acceptance)
  )
    return 'Shared assignment acceptance differs. ' + help;
  const existing = recipient.data.proposal as Record<string, unknown> | undefined;
  for (const key of ['kind', 'changeType'] as const)
    if (existing && request[key] != null && request[key] !== existing[key])
      return 'Shared assignment workflow or scope differs. ' + help;
  return undefined;
}
