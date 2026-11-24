import type { TimelineChanges } from '../../../packages/coordination/src/index.js';
import type { Data, DataScope } from '../../../packages/data/src/index.js';

type Cursor = { project: string; execution: string; sequence: string };
type Replay = { events: Array<Record<string, unknown> & { sequence: string }>; through?: Cursor };

export function acceptsTimeline(request: Request) {
  return request.headers
    .get('accept')
    ?.split(',')
    .some((value) => value.split(';')[0]?.trim() === 'text/event-stream');
}

function liveSignal(signal: AbortSignal) {
  const controller = new AbortController();
  return { controller, signal: AbortSignal.any([controller.signal, signal]) };
}

function encode(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function batch({ events, through }: Replay) {
  return events
    .map(
      (event) =>
        'id: ' +
        encode({ ...through!, sequence: event.sequence }) +
        '\nevent: observation\ndata: ' +
        JSON.stringify(event) +
        '\n\n',
    )
    .join('');
}

export async function streamTimeline(
  data: Data,
  scope: DataScope,
  input: Record<string, unknown>,
  request: Request,
  changes: TimelineChanges,
) {
  const { controller, signal } = liveSignal(request.signal);
  const resume = request.headers.get('last-event-id');
  if (resume) input.after = JSON.parse(Buffer.from(resume, 'base64url').toString());
  if (input.through !== undefined)
    throw new SyntaxError('A live timeline cannot have an end cursor');
  const replay = async (after: unknown) =>
    (await data.invoke(scope, 'execution-events', 'read', { ...input, after })) as Replay;
  try {
    const iterator = await changes(scope, signal);
    const initial = await replay(input.after);
    const body = timelineBody(initial, () => iterator.next(), replay, controller);
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    controller.abort();
    throw error;
  }
}

function timelineBody(
  initial: Replay,
  change: () => Promise<IteratorResult<void>>,
  replay: (after: unknown) => Promise<Replay>,
  controller: AbortController,
) {
  const encoder = new TextEncoder();
  let cursor = initial.through;
  return new ReadableStream<Uint8Array>({
    start(stream) {
      stream.enqueue(encoder.encode(batch(initial) || ': connected\n\n'));
    },
    async pull(stream) {
      try {
        if ((await change()).done) return stream.close();
        const updated = await replay(cursor);
        cursor = updated.through;
        stream.enqueue(encoder.encode(batch(updated) || ': observed\n\n'));
      } catch (error) {
        controller.abort();
        stream.error(error);
      }
    },
    cancel() {
      controller.abort();
    },
  });
}
