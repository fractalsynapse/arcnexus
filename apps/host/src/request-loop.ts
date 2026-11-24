import type { Context } from 'cordis';
import type { WorkflowRequests } from '../../../packages/coordination/src/index.js';
import { runHostedRequest } from './request-worker.js';

type Assignment = Parameters<typeof runHostedRequest>[2];

/** Consume commands routed to one trusted project without depending on gateway connections. */
export async function serveHostedRequests(
  requests: WorkflowRequests,
  commands: Context['commands'],
  assignment: Assignment,
  signal: AbortSignal,
) {
  const notifications = await requests.watch(assignment.remote, signal);
  try {
    while (!signal.aborted) {
      if (await runHostedRequest(requests, commands, assignment, signal)) continue;
      if ((await notifications.next()).done) break;
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    await notifications.return?.();
  }
}
