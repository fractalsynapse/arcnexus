import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation, type DataScope } from '../../data/src/index.js';
import type { TimelineSlice, TimelineWindow } from './journal-queries.js';
import { readImportedTimeline } from './postgres/read-timeline.js';

const cursorSchema = z.strictObject({
  project: z.string(),
  execution: z.string(),
  sequence: z.string().regex(/^[1-9][0-9]*$/),
});

const read = z.strictObject({
  execution: z.string(),
  after: cursorSchema.optional(),
  through: cursorSchema.optional(),
});

const event = z.strictObject({
  sequence: z.string(),
  run: z.number().int(),
  taskID: z.string(),
  goalID: z.string(),
  parent: z.number().int().optional(),
  timestamp: z.string().nullable(),
  observation: z.unknown(),
  detail: z.unknown().optional(),
});

const response = z.strictObject({ events: z.array(event), through: cursorSchema.optional() });

export type ResolveJournalProject = (
  scope: DataScope,
) => string | undefined | Promise<string | undefined>;

/** Refuse cursors from another project or execution before querying storage. */
function sequence(scope: DataScope, execution: string, cursor?: z.output<typeof cursorSchema>) {
  if (cursor && (cursor.project !== scope.project || cursor.execution !== execution))
    throw new Error('Timeline cursor is unavailable in this execution');
  return cursor?.sequence;
}

type ReplayTimeline = (
  remote: string,
  execution: string,
  window: TimelineWindow,
) => TimelineSlice | Promise<TimelineSlice>;

function registerTimeline(
  context: Context,
  resolve: ResolveJournalProject,
  replay: ReplayTimeline,
) {
  const timeline = dataOperation(read, response, async (scope, input) => {
    const remote = await resolve(scope);
    if (!remote) throw new Error('Project journal unavailable');
    const { execution } = input;
    const { events, through } = await replay(remote, execution, {
      after: sequence(scope, execution, input.after),
      through: sequence(scope, execution, input.through),
    });
    return through
      ? { events, through: { project: scope.project, execution, sequence: through } }
      : { events };
  });
  context.effect(() =>
    context.data.register({
      id: 'execution-events',
      operations: { read: timeline },
    }),
  );
}

/** Publish the local journal projection without allowing a reader to open a writer. */
export function coordinationDataPlugin(resolve: ResolveJournalProject) {
  return {
    inject: ['coordination', 'data'],
    /** Bind the same replay contract to an existing SQLite journal. */
    apply(context: Context) {
      registerTimeline(context, resolve, (remote, execution, window) =>
        context.coordination.readTaskTimeline(remote, execution, window),
      );
    },
  };
}

/** Use PostgreSQL as a read source for journals that have been copied and verified. */
export function importedCoordinationDataPlugin(database: Client, resolve: ResolveJournalProject) {
  return {
    inject: ['data'],
    /** Publish the same resource, validation, and cursor as the SQLite-backed plugin. */
    apply(context: Context) {
      registerTimeline(context, resolve, (remote, execution, window) =>
        readImportedTimeline(database, remote, execution, window),
      );
    },
  };
}
