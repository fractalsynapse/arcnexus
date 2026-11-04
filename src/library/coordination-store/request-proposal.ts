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
