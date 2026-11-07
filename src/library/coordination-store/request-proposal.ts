import type { ExecutionAssignment, InboxRequest, OwnerRequest } from './execution-types.js';

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

/** Rejects an explicit link whose requested accountable owner differs from the supplier. */
export function sharedRequestProblem(
  recipient: ExecutionAssignment,
  request: Pick<OwnerRequest, 'owner' | 'objective' | 'acceptance' | 'kind' | 'changeType'>,
): string | undefined {
  if (recipient.owner !== request.owner)
    return `Supplier owner differs from the requested owner. Read assignment.evidence artifact=${recipient.id}:intent to inspect canonical supplier scope.`;
  return undefined;
}

/** Rejects a self-link before it can mutate inbox or dependency state. */
export function assertNotSelfLink(sender: ExecutionAssignment, request: OwnerRequest): void {
  if (request.existingAssignmentId === sender.id)
    throw Object.assign(new Error('An assignment cannot link itself as a supplier'), {
      name: 'DependencyBlocked',
    });
}

/** Stores workflow only on newly created work; explicit links preserve supplier workflow. */
export function storeInitialProposal(
  sender: ExecutionAssignment,
  recipient: ExecutionAssignment,
  request: OwnerRequest,
): void {
  if (request.existingAssignmentId === undefined)
    recipient.data.proposal ??= requestProposal(sender, request);
}

/** Returns the original supplier identity only for an exact replay of its request envelope. */
export function repeatedRequestAssignment(existing: InboxRequest, request: OwnerRequest): string {
  const { id: _id, from: _from, assignmentId, ...original } = existing;
  if (JSON.stringify(original) !== JSON.stringify(request))
    throw new Error('Request identity reused with different content');
  return assignmentId;
}
