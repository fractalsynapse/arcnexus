import { gatewayRequest } from './resource.js';

export interface TimelineFrame {
  sequence: string;
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
  await readFrames(response.body.pipeThrough(new TextDecoderStream()), receive);
}

async function readFrames(stream: ReadableStream<string>, receive: (event: TimelineEvent) => void) {
  const reader = stream.getReader();
  let pending = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      pending += chunk.value;
      let boundary = pending.indexOf('\n\n');
      while (boundary !== -1) {
        const event = decode(pending.slice(0, boundary));
        if (event) receive(event);
        pending = pending.slice(boundary + 2);
        boundary = pending.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function decode(block: string): TimelineEvent | undefined {
  if (!/^event: observation$/m.test(block)) return;
  const id = /^id: (.+)$/m.exec(block)?.[1];
  const data = /^data: (.+)$/m.exec(block)?.[1];
  if (id && data) return { id, frame: JSON.parse(data) as TimelineFrame };
}
