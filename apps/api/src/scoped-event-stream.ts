import type { TimelineChanges } from '../../../packages/coordination/src/index.js';
import type { DataScope } from '../../../packages/data/src/index.js';

export function acceptsEvents(request: Request) {
  return request.headers
    .get('accept')
    ?.split(',')
    .some((value) => value.split(';')[0]?.trim() === 'text/event-stream');
}

/** Subscribe before reading so the stream can observe any committed change during the first read. */
export async function scopedEventStream(
  request: Request,
  scope: DataScope,
  changes: TimelineChanges,
  read: () => Promise<string>,
) {
  const lifetime = new AbortController();
  const signal = AbortSignal.any([lifetime.signal, request.signal]);
  try {
    const iterator = await changes(scope, signal);
    const initial = await read();
    return new Response(eventBody(iterator, initial, read, lifetime), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    lifetime.abort();
    throw error;
  }
}

function eventBody(
  iterator: AsyncIterator<unknown>,
  initial: string,
  read: () => Promise<string>,
  lifetime: AbortController,
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(stream) {
      stream.enqueue(encoder.encode(initial || ': connected\n\n'));
    },
    async pull(stream) {
      try {
        if ((await iterator.next()).done) {
          stream.close();
          lifetime.abort();
          return;
        }
        stream.enqueue(encoder.encode((await read()) || ': observed\n\n'));
      } catch (error) {
        lifetime.abort();
        stream.error(error);
      }
    },
    cancel() {
      lifetime.abort();
    },
  });
}
