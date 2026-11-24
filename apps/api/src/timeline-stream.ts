import type { TimelineChanges } from '../../../packages/coordination/src/index.js';
import type { Data, DataScope } from '../../../packages/data/src/index.js';
import { scopedEventStream } from './scoped-event-stream.js';

type Cursor = { project: string; execution: string; sequence: string };
type Replay = { events: Array<Record<string, unknown> & { sequence: string }>; through?: Cursor };

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
  const resume = request.headers.get('last-event-id');
  if (resume) input.after = JSON.parse(Buffer.from(resume, 'base64url').toString());
  if (input.through !== undefined)
    throw new SyntaxError('A live timeline cannot have an end cursor');
  let cursor = input.after;
  return scopedEventStream(request, scope, changes, async () => {
    const replay = (await data.invoke(scope, 'execution-events', 'read', {
      ...input,
      after: cursor,
    })) as Replay;
    cursor = replay.through;
    return batch(replay);
  });
}
