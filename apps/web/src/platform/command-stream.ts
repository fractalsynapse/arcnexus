import {
  currentWorkflow,
  type CurrentWorkflow,
  type Receipt,
} from '../../../../packages/commands/src/browser.js';
import { readServerEvents } from '../../../../packages/foundation/src/server-events.js';
import type { CommandState, Operation } from '../../../../packages/ui/src/index.js';
import { gatewayRequest } from './resource.js';

export const unavailable: CommandState = { status: 'Unavailable', supported: [] };
const supported: readonly Operation[] = ['plan', 'architect', 'run'];

const labels: Record<Receipt['request']['command'], string> = {
  task_plan: 'Plan',
  task_run: 'Run',
  architecture_update: 'Architect',
  refine: 'Refine',
};

/** Follow the latest scoped receipt through the same browser API transport as other displays. */
export async function followCommands(
  path: string,
  signal: AbortSignal,
  receive: (data: CurrentWorkflow) => void,
) {
  const response = await gatewayRequest(path + '/current', {
    signal,
    headers: { accept: 'text/event-stream' },
  });
  if (!response.body || !response.headers.get('content-type')?.startsWith('text/event-stream'))
    throw new Error('Command updates are unavailable.');
  await readServerEvents(response.body, (frame) => {
    if (!/^event: command$/m.test(frame)) return;
    const data = /^data: (.+)$/m.exec(frame)?.[1];
    if (data && !signal.aborted) receive(currentWorkflow.parse(JSON.parse(data) as unknown));
  });
}

function stopped(receipt: Receipt) {
  const { outcome } = receipt;
  if (!outcome || typeof outcome !== 'object' || !('kind' in outcome)) return;
  if (outcome.kind === 'cancelled') return 'Cancelled';
  if (outcome.kind === 'blocked') return 'Waiting';
  if (outcome.kind === 'failed' || outcome.kind === 'invalid') return 'Failed';
  if (outcome.kind === 'round' && 'completed' in outcome && !outcome.completed) return 'Failed';
}

function status(receipt: Receipt | null, canSubmit: boolean): CommandState['status'] {
  if (receipt?.state === 'finished') return stopped(receipt) ?? 'Completed';
  if (receipt?.state === 'waiting') return 'Waiting';
  if (receipt?.state === 'queued' || receipt?.state === 'running') return 'Active';
  return canSubmit ? 'Idle' : 'Unavailable';
}

export function dockState({ receipt, canSubmit }: CurrentWorkflow, scope: string): CommandState {
  const busy = receipt && receipt.state !== 'finished';
  return {
    scope,
    status: status(receipt, canSubmit),
    supported: canSubmit && !busy ? supported : [],
    canCancel: Boolean(busy),
    command: receipt ? labels[receipt.request.command] : undefined,
    execution: receipt?.execution ?? undefined,
    gate:
      receipt?.state === 'waiting' && receipt.gate
        ? { ...receipt.gate, key: receipt.id + '/' + receipt.gate.id }
        : undefined,
  };
}
