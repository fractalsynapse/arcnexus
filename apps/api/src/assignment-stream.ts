/** Send only a project ID and pinned revision over the authenticated presence connection. */
export type LauncherAssignments = (
  provider: string,
  signal: AbortSignal,
) => AsyncIterable<{ project: string; revision: string; documentationOnly?: boolean }>;

type Presence = { signal: AbortSignal; close(): void };
const encoder = new TextEncoder();

function frame(name: string, value: object) {
  return encoder.encode('event: ' + name + '\ndata: ' + JSON.stringify(value) + '\n\n');
}

/** Keep one assignment feed within the lifetime of the admitted provider connection. */
export function assignmentStream(
  provider: string,
  presence: Presence,
  request: AbortSignal,
  assignments?: LauncherAssignments,
) {
  const signal = AbortSignal.any([presence.signal, request]);
  let ended = false;
  return new ReadableStream<Uint8Array>({
    start(stream) {
      const stop = (error?: unknown) => {
        if (ended) return;
        ended = true;
        if (error !== undefined) stream.error(error);
        else if (!request.aborted) stream.close();
        presence.close();
      };
      connectStream(stream, signal, stop, assignments && (() => assignments(provider, signal)));
    },
    cancel() {
      ended = true;
      presence.close();
    },
  });
}

function connectStream(
  stream: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal,
  stop: (error?: unknown) => void,
  assignments?: () => ReturnType<LauncherAssignments>,
) {
  if (signal.aborted) return stop();
  const close = () => stop();
  signal.addEventListener('abort', close, { once: true });
  stream.enqueue(frame('ready', {}));
  if (assignments) void publish(stream, close, signal, assignments()).catch(stop);
}

async function publish(
  stream: ReadableStreamDefaultController<Uint8Array>,
  close: () => void,
  signal: AbortSignal,
  assignments: ReturnType<LauncherAssignments>,
) {
  for await (const assignment of assignments) {
    if (signal.aborted) return;
    stream.enqueue(frame('assignment', assignment));
  }
  if (!signal.aborted) close();
}
