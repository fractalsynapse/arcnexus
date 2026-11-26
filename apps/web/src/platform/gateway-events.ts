import { readServerEvents } from '../../../../packages/foundation/src/server-events.js';
import { gatewayRequest } from './resource.js';

interface EventStream {
  kind: string;
  cursor?: string;
  signal: AbortSignal;
  unavailable: string;
  receive: (data: unknown, id?: string) => void;
}

/** Decode a scoped gateway stream with one transport, cursor and framing implementation. */
export async function followGatewayEvents(path: string, stream: EventStream) {
  const { kind, cursor, signal, unavailable, receive } = stream;
  const headers = new Headers({ Accept: 'text/event-stream' });
  if (cursor) headers.set('Last-Event-ID', cursor);
  // Keep the open stream out of the HTTP cache so JSON reads at the same URL can finish.
  const response = await gatewayRequest(path, { headers, signal, cache: 'no-store' });
  if (!response.body || !response.headers.get('content-type')?.startsWith('text/event-stream'))
    throw new Error(unavailable);
  await readServerEvents(response.body, (frame) => {
    if (signal.aborted || /^event: (.+)$/m.exec(frame)?.[1] !== kind) return;
    const data = /^data: (.+)$/m.exec(frame)?.[1];
    const id = /^id: (.+)$/m.exec(frame)?.[1];
    if (data) receive(JSON.parse(data) as unknown, id);
  });
}
