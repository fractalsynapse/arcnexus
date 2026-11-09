import { join } from 'node:path';
import { ExecutionStore } from '../coordination-store/execution-store.js';
import { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import type { ExecutionAssignment, ExecutionRun } from '../coordination-store/execution-types.js';
import type { RecordData } from '../workspace/state.js';
import { ExecutionObservations } from './execution-observations.js';
import { ExecutionEvidence } from './execution-evidence.js';
import { DeliveryEvidence } from './delivery-evidence.js';

/** Pins pre-integration observations to the specific checked Git revision without predicting release. */
export class PublicationEvidence {
  /** Binds reads to a single repository host's captured stores and private outputs. */
  constructor(
    private readonly root: string,
    private readonly project: string,
  ) {}

  /** Supplies real run history, prior supplier verdicts and complete outputs of the assembled checks. */
  capture(run: ExecutionRun, record: RecordData, assignments: ExecutionAssignment[]) {
    if (
      record.activationRole !== 'publication-checks' ||
      record.executionRunId !== run.id ||
      JSON.stringify(record.executionEnvironment) !== JSON.stringify(run.environment)
    )
      throw new Error('Publication check evidence belongs to another run or environment');
    const directory = join(this.root, 'projects', this.project);
    const store = new ExecutionStore(join(directory, 'execution.sqlite'), true);
    try {
      const evidence = new ExecutionEvidence(this.root, store).capture(run.id);
      return {
        ...evidence,
        publication: {
          stage: 'before integration and release',
          environment: run.environment,
          head: record.base,
          recordId: record.id,
          effects: this.effects(directory, run),
          observations: new ExecutionObservations(join(this.root, 'runs', record.id)).capture(
            record,
          ),
          sourceDeliveries: this.sources(run, assignments),
        },
      };
    } finally {
      store.close();
    }
  }

  /** Distinguishes the verdicts captured for each execution environment. */
  private sources(run: ExecutionRun, assignments: ExecutionAssignment[]) {
    const evidence = new DeliveryEvidence(this.root);
    return assignments
      .filter((a) => a.runId !== run.id)
      .map((a) => ({
        runId: a.runId,
        assignmentId: a.id,
        verificationReports: evidence.capture(a, false),
      }));
  }

  /** Reports only this run's upstream activity and separates uncertain intents from completed receipts. */
  private effects(directory: string, run: ExecutionRun) {
    const store = new LifecycleStore(join(directory, 'lifecycle.sqlite'), true);
    try {
      const deliveryId =
        run.data.publicationDeliveryId ?? run.data.pendingPublication ?? run.data.deliveryId;
      const effects = store
        .effects()
        .filter(
          (e) =>
            e.runId === run.id &&
            e.environmentId === run.environment?.id &&
            (!e.input.deliveryId || e.input.deliveryId === deliveryId),
        );
      const ids = new Set(effects.map((e) => e.id));
      return {
        operations: effects.map(({ id, operation, status, result }) => ({
          id,
          operation,
          status,
          head: result?.head,
          checks: result?.checks,
        })),
        chronology: store.events().filter((event) => ids.has(String(event.data.id))),
      };
    } finally {
      store.close();
    }
  }
}
