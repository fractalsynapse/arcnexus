import { followGatewayEvents } from './gateway-events.js';
import type { GatewayClient } from './gateway-client.js';

export interface TimelineFrame {
  sequence: string;
  run?: number;
  taskID?: string;
  timestamp: string | null;
  observation: unknown;
}

interface TimelineEvent {
  id: string;
  frame: TimelineFrame;
}

/** Decode ordered SSE frames without truncating split UTF-8 characters or message lines. */
export async function followTimeline(
  gateway: GatewayClient,
  path: string,
  signal: AbortSignal,
  cursor: string | undefined,
  receive: (event: TimelineEvent) => void,
) {
  await followGatewayEvents(gateway, path, {
    kind: 'observation',
    signal,
    cursor,
    unavailable: 'The live event stream is unavailable.',
    receive: (data, id) => {
      if (id) receive({ id, frame: data as TimelineFrame });
    },
  });
}
