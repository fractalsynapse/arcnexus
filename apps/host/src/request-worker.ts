import type { Context } from 'cordis';
import { dispatchWorkflow, workflowRequest } from '../../../packages/commands/src/index.js';
import type { WorkflowGate, WorkflowRequests } from '../../../packages/coordination/src/index.js';
import type { RuntimeImage } from '../../../packages/foundation/src/runtime-image.js';
import { textDigest } from '../../../packages/foundation/src/index.js';
import type {
  RoundOutcome,
  TaskObserver,
  TaskQuestion,
} from '../../../packages/workflow/src/index.js';

interface Assignment {
  revision: string;
  remote: string;
  directory: string;
  worker: string;
  runtime?: RuntimeImage;
}

/** Run one durably admitted command using the normal Host services and journal. */
export async function runHostedRequest(
  requests: WorkflowRequests,
  commands: Context['commands'],
  owner: Assignment,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const request = await requests.claim(owner);
  if (!request) return false;
  const observer = new RequestObserver(requests, owner, request.id, request);
  const command = workflowRequest.parse(request.request);
  const outcome = await withCancellation(requests, owner, request.id, signal, async (active) =>
    dispatchWorkflow(commands, owner.directory, command, observer, active, {
      invocation: request.id,
      documentationDirectories: request.documentationDirectories ?? undefined,
    }),
  );
  await observer.bind;
  if (outcome.kind === 'cancelled' && observer.bind && !observer.terminal) return true;
  await requests.settle(
    owner,
    request.id,
    outcome,
    outcome.kind === 'blocked' || (outcome.kind === 'round' && !outcome.completed)
      ? observer.held
      : undefined,
  );
  return true;
}

/** Bind a command to its retained execution and pass an answer to its exact originating gate. */
class RequestObserver implements TaskObserver {
  private used = false;
  terminal = false;
  held?: WorkflowGate;
  bind?: Promise<void>;

  /** Reopen the saved command with its previously submitted answer. */
  constructor(
    private readonly requests: WorkflowRequests,
    private readonly owner: Assignment,
    private readonly id: string,
    private readonly saved: { gate: WorkflowGate | null; reply: string | null },
  ) {}

  /** Forward durable observations through the existing journal projection. */
  progress() {}

  /** Bind the first root task ID while the Host continues to write its journal. */
  event(frame: Parameters<NonNullable<TaskObserver['event']>>[0]) {
    if (
      frame.parent === undefined &&
      typeof frame.observation === 'object' &&
      frame.observation &&
      'outcome' in frame.observation
    )
      this.terminal = true;

    if (!frame.parent && !this.bind) {
      this.bind = this.requests.bind(this.owner, this.id, frame.taskID);
      void this.bind.catch(() => {});
    }
  }

  /** Retain the accepted aggregate before closing the inventory round. */
  async completeRound(outcome: RoundOutcome) {
    await this.requests.completeRound(this.owner, this.id, outcome);
  }

  /** Release the Host for an unanswered question, or return its exact submitted reply. */
  async answer(_question: string, signal: AbortSignal, source?: TaskQuestion) {
    signal.throwIfAborted();
    if (!source) return undefined;
    const gate = {
      id: textDigest(JSON.stringify([source.scope, source.question])),
      question: source.question,
      ...(source.review && { review: source.review }),
    };
    if (!this.used && this.saved.gate?.id === gate.id && this.saved.reply !== null) {
      this.used = true;
      return this.saved.reply;
    }
    this.held = gate;
    return undefined;
  }
}

async function withCancellation<T>(
  requests: WorkflowRequests,
  owner: Assignment,
  id: string,
  signal: AbortSignal,
  execute: (active: AbortSignal) => Promise<T>,
) {
  const lifetime = new AbortController();
  const cancelled = new AbortController();
  const active = AbortSignal.any([signal, cancelled.signal]);
  const monitor = watchCancellation(requests, owner, id, lifetime.signal).then(
    () => {
      if (!lifetime.signal.aborted) cancelled.abort(new Error('Cancelled by operator'));
    },
    (error: unknown) => {
      if (!lifetime.signal.aborted) cancelled.abort(error);
    },
  );
  try {
    return await execute(active);
  } finally {
    lifetime.abort();
    await monitor;
  }
}

async function watchCancellation(
  requests: WorkflowRequests,
  owner: Assignment,
  id: string,
  signal: AbortSignal,
) {
  const notifications = await requests.watch(owner.remote, signal);
  try {
    while (!(await requests.cancelled(owner, id))) {
      if ((await notifications.next()).done)
        throw new Error('Workflow cancellation subscription ended');
    }
  } finally {
    await notifications.return?.();
  }
}
