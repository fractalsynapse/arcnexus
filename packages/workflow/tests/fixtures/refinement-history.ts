import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { JournalEvent } from '../../../coordination/src/index.js';
import type { CompletedRefinementRound } from '../../src/index.js';

/** Read the canonical SQLite origins independently of report timeline reconstruction. */
export function history(storage: string, remote: string, tasks: ReadonlySet<string>) {
  const project = createHash('sha256').update(remote).digest('hex');
  const database = new DatabaseSync(join(storage, project, 'tasks.sqlite'), { readOnly: true });
  try {
    const rows = database
      .prepare(
        `
      SELECT events.id, events.run, runs.task_id, runs.goal_id, runs.parent_id,
        events.recorded_at, events.content FROM events
      JOIN runs ON events.run = runs.id ORDER BY events.id
    `,
      )
      .all();
    const selected = descendantTasks(rows, tasks);
    return rows
      .filter((row) => selected.has(String(row.task_id)))
      .map((row) => ({
        sequence: String(row.id),
        run: Number(row.run),
        taskID: String(row.task_id),
        goalID: String(row.goal_id),
        parent: row.parent_id === null ? undefined : Number(row.parent_id),
        timestamp: row.recorded_at as string | null,
        observation: JSON.parse(String(row.content)) as Record<string, any>,
      }));
  } finally {
    database.close();
  }
}

type Origins = ReturnType<typeof history>;

/** Compare every origin and terminal result, in order, against the canonical journal. */
export function assertOrigins(completion: CompletedRefinementRound, origins: Origins) {
  const report = readFileSync(completion.report, 'utf8');
  const frames = report
    .split('\n')
    .filter((line) => line.startsWith('{"sequence":'))
    .map((line) => JSON.parse(line) as JournalEvent);
  assert.deepEqual(
    completion.findings,
    origins.map((event) => event.sequence),
  );
  assert.deepEqual(frames, origins);
  const measured = origins.filter(({ observation }) =>
    ['nativeStarted', 'nativeEvent', 'nativeFinished', 'nativeInvocation'].some(
      (key) => key in observation,
    ),
  );
  assert.deepEqual(
    completion.measurements,
    measured.map(({ sequence }) => sequence),
  );
  const terminals = origins.flatMap(({ observation }) =>
    observation.outcome ? [observation.outcome] : [],
  );
  assert.equal(new Set(completion.findings).size, origins.length);
  const sources = origins.flatMap(({ observation }) =>
    observation.nativeEvent?.kind === 'event' ? [observation.nativeEvent.source as string] : [],
  );
  const native = [...new Set(sources)].map((source) => readFileSync(source, 'utf8')).join('\n');
  return { report, terminals, native };
}

/** Reconcile profile totals directly against each retained provider event, without the projection. */
export function assertAccounting(report: string, origins: Origins) {
  const snapshot = JSON.parse(report.split('## Event-derived measurements\n\n')[1]!);
  const starts = origins.filter(({ observation }) => observation.nativeStarted);
  const turns = origins.flatMap(({ observation }) =>
    observation.nativeEvent?.event?.type === 'turn.completed'
      ? [observation.nativeEvent.event.usage]
      : [],
  );
  const profiles = [...new Set(starts.map(({ observation }) => observation.nativeStarted.profile))];
  assert.deepEqual(
    snapshot.profiles.map((profile: { profile: string }) => profile.profile).sort(),
    profiles.sort(),
  );
  for (const name of profiles) {
    const selected = profileOrigins(origins, name);
    assertProfile(
      snapshot.profiles.find((profile: { profile: string }) => profile.profile === name),
      selected,
    );
  }
  assertUsage(snapshot.usage, snapshot.usage, turns);
  assert.equal(snapshot.cost.estimate, null);
  return snapshot.profiles[0];
}

/** Compare one explicit profile with its originating native activation records. */
function assertProfile(profile: Record<string, any>, origins: Origins) {
  const ends = origins.filter(({ observation }) => observation.nativeFinished);
  const starts = origins.filter(({ observation }) => observation.nativeStarted);
  const ends = origins.filter(({ observation }) => observation.nativeFinished);
  const turns = origins.flatMap(({ observation }) =>
    observation.nativeEvent?.event?.type === 'turn.completed'
      ? [observation.nativeEvent.event.usage]
      : [],
  );
  assert.equal(profile.model, 'fixture-model');
  assert.equal(profile.activations, starts.length);
  assert.equal(profile.finishedActivations, ends.length);
  assert.equal(
    profile.durationMs,
    ends.reduce((sum, frame) => sum + frame.observation.nativeFinished.durationMs, 0),
  );
  assertUsage(profile.usage, profile.usage, turns);
  assert.equal(profile.activationsWithoutUsage, starts.length - turns.length);
  assert.equal(profile.activeActivations, 0);
  assert.equal(profile.incompleteActivations, 0);
  assert.equal(
    profile.failedActivations,
    ends.filter(({ observation }) => observation.nativeFinished.failure !== undefined).length,
  );
}

/** Verify reported token subsets separately and keep absent provider categories unknown. */
function assertUsage(
  total: Record<string, unknown>,
  profile: Record<string, unknown>,
  turns: Record<string, number>[],
) {
  for (const field of [
    'input_tokens',
    'output_tokens',
    'cached_input_tokens',
    'cache_write_input_tokens',
    'reasoning_output_tokens',
  ]) {
    const values = turns.flatMap((turn) => (field in turn ? [turn[field]!] : []));
    const expected = {
      reported: values.length ? values.reduce((sum, value) => sum + value, 0) : null,
      missingTurns: turns.length - values.length,
    };
    assert.deepEqual(profile[field], expected);
    assert.deepEqual(total[field], expected);
  }
}

/** Expand logical descendants across all parent attempts independently of the production query. */
function descendantTasks(rows: Record<string, unknown>[], tasks: ReadonlySet<string>) {
  const selected = new Set(tasks);
  let changed = true;
  while (changed) {
    const parents = new Set(
      rows.filter((row) => selected.has(String(row.task_id))).map((row) => Number(row.run)),
    );
    const size = selected.size;
    for (const row of rows)
      if (row.parent_id !== null && parents.has(Number(row.parent_id)))
        selected.add(String(row.task_id));
    changed = selected.size !== size;
  }
  return selected;
}

/** Select all observations correlated to activations attributed to one explicit profile. */
function profileOrigins(origins: Origins, name: string) {
  const starts = origins.filter(({ observation }) => observation.nativeStarted);
  const activations = new Set(
    starts
      .filter(({ observation }) => observation.nativeStarted.profile === name)
      .map(({ observation }) => observation.nativeStarted.activation),
  );
  return origins.filter(({ observation }) =>
    activations.has(
      observation.nativeStarted?.activation ??
        observation.nativeEvent?.activation ??
        observation.nativeFinished?.activation,
    ),
  );
}
