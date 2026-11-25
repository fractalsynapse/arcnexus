import { readServerEvents } from '../../../../packages/foundation/src/server-events.js';
import { gatewayRequest } from './resource.js';

export interface TimelineFrame {
  sequence: string;
  run?: number;
  timestamp: string | null;
  observation: unknown;
}

interface TimelineEvent {
  id: string;
  frame: TimelineFrame;
}

/** Decode ordered SSE frames without truncating split UTF-8 characters or message lines. */
export async function followTimeline(
  path: string,
  token: string,
  signal: AbortSignal,
  cursor: string | undefined,
  receive: (event: TimelineEvent) => void,
) {
  const headers = new Headers({ Accept: 'text/event-stream' });
  if (cursor) headers.set('Last-Event-ID', cursor);
  const response = await gatewayRequest(path, token, { headers, signal });
  if (!response.body || !response.headers.get('content-type')?.startsWith('text/event-stream'))
    throw new Error('The live event stream is unavailable.');
  await readServerEvents(response.body, (frame) => {
    const event = decode(frame);
    if (event) receive(event);
  });
}

function decode(block: string): TimelineEvent | undefined {
  if (!/^event: observation$/m.test(block)) return;
  const id = /^id: (.+)$/m.exec(block)?.[1];
  const data = /^data: (.+)$/m.exec(block)?.[1];
  if (id && data) return { id, frame: JSON.parse(data) as TimelineFrame };
}
