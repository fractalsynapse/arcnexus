import { frequencies, toolCountsSchema } from './tool-frequency.js';
import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation, type DataScope } from '../../../data/src/index.js';
import type { JournalEvent } from '../journal-types.js';
import type { ResolveJournalProject } from '../data.js';
import { RunMeasurements } from '../measurements.js';
import { readPlanReference } from './plan-records.js';
import { readImportedTimeline } from './read-timeline.js';

const selection = z.strictObject({ execution: z.string().min(1) });
const reference = z.strictObject({
  execution: z.string(),
  revision: z.string(),
  active: z.boolean(),
});
const currentSchema = z.strictObject({
  execution: z.string().nullable(),
  revision: z.string().nullable(),
  active: z.boolean(),
});
const outcomeSchema = reference.extend({ outcome: z.unknown().nullable() });
const metrics = z
  .object({
    wallElapsedMs: z.number().nullable(),
    nativeElapsedMs: z.number().nullable(),
    usage: z.unknown(),
    cost: z.unknown(),
  })
  .passthrough();

function projections(database: Client, resolve: ResolveJournalProject) {
  const remoteFor = (scope: DataScope) => projectFor(resolve, scope);
  const load = (scope: DataScope, execution: string) =>
    planEvents(database, remoteFor, scope, execution);
  return {
    current: dataOperation(
      z.strictObject({}),
      currentSchema,
      async (scope) =>
        (await readPlanReference(database, await remoteFor(scope))) ?? {
          execution: null,
          revision: null,
          active: false,
        },
    ),
    outcome: dataOperation(selection, outcomeSchema, async (scope, { execution }) => {
      const { task, events } = await load(scope, execution);
      const outcome = lastOutcome(events, execution);
      return { ...task, outcome };
    }),
    'tool-counts': dataOperation(selection, toolCountsSchema, async (scope, { execution }) =>
      frequencies((await load(scope, execution)).events),
    ),
    metrics: dataOperation(selection, metrics, async (scope, { execution }) => {
      const { events } = await load(scope, execution);
      return measured(events, execution);
    }),
  };
}

async function projectFor(resolve: ResolveJournalProject, scope: DataScope) {
  const remote = await resolve(scope);
  if (!remote) throw new Error('Project unavailable');
  return remote;
}

async function planEvents(
  database: Client,
  resolve: (scope: DataScope) => Promise<string>,
  scope: DataScope,
  execution: string,
) {
  const remote = await resolve(scope);
  const task = await readPlanReference(database, remote, execution);
  if (!task) throw new Error('Planning execution unavailable');
  return { task, events: (await readImportedTimeline(database, remote, execution)).events };
}

function lastOutcome(events: JournalEvent[], execution: string) {
  return (
    events
      .filter((event) => event.taskID === execution)
      .map((event) => (event.observation as { outcome?: unknown } | null)?.outcome)
      .findLast((item) => item !== undefined) ?? null
  );
}

function measured(events: JournalEvent[], execution: string) {
  const measurements = new RunMeasurements();
  for (const frame of events)
    measurements.accept(frame.taskID === execution ? { ...frame, parent: undefined } : frame);
  return measurements.snapshot();
}

/** Register independent read models without loading guide files or starting workflows. */
export function planExecutionDataPlugin(database: Client, resolve: ResolveJournalProject) {
  return {
    inject: ['data'],
    /** Publish retained Plan selection, outcome, and measurement projections. */
    apply(context: Context) {
      context.effect(() =>
        context.data.register({
          id: 'plan-executions',
          operations: projections(database, resolve),
        }),
      );
    },
  };
}
