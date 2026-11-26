import { frequencies, toolCountsSchema } from './tool-frequency.js';
import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation, type DataScope } from '../../../data/src/index.js';
import type { JournalEvent } from '../journal-types.js';
import type { ResolveJournalProject } from '../data.js';
import { RunMeasurements } from '../measurements.js';
import { listPlanReferences, planReference, readPlanReference } from './plan-records.js';
import { loadPlanEvents } from './plan-events.js';
import { tokenHistory, tokenHistorySchema } from './token-history.js';

const selection = z.strictObject({ execution: z.string().min(1) });
const currentSchema = planReference.extend({
  execution: z.string().nullable(),
  revision: z.string().nullable(),
});
const outcomeSchema = planReference.extend({
  outcome: z.unknown().nullable(),
  report: z.unknown().optional(),
  changedPaths: z.array(z.string()),
  issue: z.string().optional(),
  pull: z.object({ url: z.string(), state: z.string().optional() }).optional(),
});
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
  const load = async (scope: DataScope, execution: string) =>
    loadPlanEvents(database, await remoteFor(scope), execution);
  return {
    current: currentPlan(database, remoteFor),
    list: dataOperation(
      z.strictObject({}),
      z.strictObject({ entries: z.array(planReference) }),
      async (scope) => ({ entries: await listPlanReferences(database, await remoteFor(scope)) }),
    ),
    outcome: dataOperation(selection, outcomeSchema, async (scope, { execution }) => {
      const { task, events } = await load(scope, execution);
      return { ...task, ...planResult(events, execution, task.attempt), ...guideChanges(events) };
    }),
    'tool-counts': dataOperation(selection, toolCountsSchema, async (scope, { execution }) =>
      frequencies((await load(scope, execution)).events),
    ),
    'token-history': dataOperation(selection, tokenHistorySchema, async (scope, { execution }) =>
      tokenHistory((await load(scope, execution)).events),
    ),
    metrics: dataOperation(selection, metrics, async (scope, { execution }) => {
      const { events } = await load(scope, execution);
      return measured(events, execution);
    }),
  };
}

type PlanEvidence = {
  issue?: string;
  publication?: { issue?: string };
  publicationObserved?: { pull?: { url: string; state?: string } | null };
  publicationVerification?: { pr?: string };
  plannerEdits?: { edits: { path: string }[] };
  editReceipt?: { path: string };
};

function guideChanges(events: JournalEvent[]) {
  const changed = new Set<string>();
  let issue: string | undefined;
  let pull: { url: string; state?: string } | undefined;
  for (const { observation } of events) {
    const event = observation as PlanEvidence | null;
    if (!event) continue;
    issue = event.publication?.issue ?? event.issue ?? issue;
    pull = event.publicationObserved?.pull ?? pull;
    if (!pull && event.publicationVerification?.pr)
      pull = { url: event.publicationVerification.pr };
    if (event.editReceipt) changed.add(event.editReceipt.path);
    for (const edit of event.plannerEdits?.edits ?? []) changed.add(edit.path);
  }
  return { changedPaths: [...changed], issue: typeof issue === 'string' ? issue : undefined, pull };
}

async function projectFor(resolve: ResolveJournalProject, scope: DataScope) {
  const remote = await resolve(scope);
  if (!remote) throw new Error('Project unavailable');
  return remote;
}

function planResult(events: JournalEvent[], execution: string, attempt?: string) {
  let outcome: unknown = null;
  let report: unknown;
  for (const frame of events) {
    if (frame.taskID !== execution) continue;
    const event = frame.observation as {
      outcome?: unknown;
      plannerProposal?: { proposal?: unknown };
    } | null;
    if (event?.outcome !== undefined && String(frame.run) === attempt) outcome = event.outcome;
    if (event?.plannerProposal?.proposal !== undefined) report = event.plannerProposal.proposal;
  }
  return { outcome, report };
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

function currentPlan(database: Client, remoteFor: (scope: DataScope) => Promise<string>) {
  return dataOperation(
    z.strictObject({}),
    currentSchema,
    async (scope) =>
      (await readPlanReference(database, await remoteFor(scope))) ?? {
        execution: null,
        revision: null,
        active: false,
        startedAt: null,
        updatedAt: null,
      },
  );
}
