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
    return database
      .prepare(
        `
      SELECT events.id, events.run, runs.task_id, events.content FROM events
      JOIN runs ON events.run = runs.id ORDER BY events.id
    `,
      )
      .all()
      .filter((row) => tasks.has(String(row.task_id)))
      .map((row) => ({
        sequence: String(row.id),
        run: Number(row.run),
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
  assert.deepEqual(
    frames.map(({ sequence, run, observation }) => ({
      sequence,
      run,
      observation,
    })),
    origins,
  );
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
  assert.deepEqual(
    frames.flatMap(({ observation }) => {
      const record = observation as { outcome?: unknown };
      return record.outcome ? [record.outcome] : [];
    }),
    terminals,
  );
  assert.equal(new Set(completion.findings).size, origins.length);
  return { report, terminals };
}

/** Reconcile profile totals directly against each retained provider event, without the projection. */
export function assertAccounting(report: string, origins: Origins) {
  const snapshot = JSON.parse(report.split('## Event-derived measurements\n\n')[1]!);
  const starts = origins.filter(({ observation }) => observation.nativeStarted);
  const ends = origins.filter(({ observation }) => observation.nativeFinished);
  const turns = origins.flatMap(({ observation }) =>
    observation.nativeEvent?.event?.type === 'turn.completed'
      ? [observation.nativeEvent.event.usage]
      : [],
  );
  assert.equal(snapshot.profiles.length, 1);
  const profile = snapshot.profiles[0];
  assert.equal(profile.profile, 'planner-fixture');
  assert.equal(profile.model, 'fixture-model');
  assert.equal(profile.activations, starts.length);
  assert.equal(profile.finishedActivations, ends.length);
  assert.equal(
    profile.durationMs,
    ends.reduce((sum, frame) => sum + frame.observation.nativeFinished.durationMs, 0),
  );
  for (const field of ['input_tokens', 'output_tokens']) {
    const reported = turns.reduce((sum, turn) => sum + turn[field], 0);
    assert.deepEqual(profile.usage[field], { reported, missingTurns: 0 });
    assert.deepEqual(snapshot.usage[field], { reported, missingTurns: 0 });
  }
  assert.equal(snapshot.cost.estimate, null);
  return profile;
}
