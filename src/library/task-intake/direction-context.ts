import { OwnerRetrieval } from './retrieval.js';
import { DirectionEvidence } from './direction-evidence.js';
import { join } from 'node:path';
import { catalogContext, type Component } from '../architecture/components.js';
import type { OperationBridge } from '../operations/operations.js';
import { EvidencePages } from '../report/report.js';
import type { RecordData } from '../workspace/state.js';

export interface RetainedDirection {
  purpose: string;
  state: unknown;
  feedback: unknown;
}

/** Pins full direction inputs outside the prompt without filtering owners or discarding retained evidence. */
export class DirectionContext {
  private readonly pages = new EvidencePages('direction.evidence');

  /** Captures immutable catalog and checkpoint artifacts for one read-only model activation. */
  constructor(
    root: string,
    record: RecordData,
    catalog: Component[],
    retained?: RetainedDirection,
    goal?: string,
  ) {
    this.catalog(catalog, goal);
    if (retained)
      this.state(String(record.executionRunId), {
        ...retained,
        state: new DirectionEvidence(root, String(record.executionRunId)).capture(retained.state),
      });
    const manifest = {
      runId: record.executionRunId,
      recordId: record.id,
      artifacts: this.pages.metadata(),
    };
    this.pages.add('manifest', JSON.stringify(manifest), 'json');
    record.directionEvidence = this.pages.retain(join(root, 'runs', record.id), manifest);
  }

  /** Adds the existing bounded read capability while retaining operation confinement and cancellation. */
  wrap(operations: OperationBridge): OperationBridge {
    return this.pages.wrap(operations);
  }

  /** Makes every eligible owner discoverable and exposes its complete captured contracts separately. */
  private catalog(components: Component[], goal?: string): void {
    const catalog = catalogContext(components);
    const index = catalog.components.map((component) => {
      const artifact = 'owner:' + String(component.id);
      this.pages.add(artifact, JSON.stringify(component), 'json');
      return { id: component.id, purpose: component.purpose, type: component.type, artifact };
    });
    if (goal) {
      const matches = new OwnerRetrieval(components).select(goal);
      const scores = new Map(matches.map((match) => [match.id, match.score]));
      index.sort((a, b) => (scores.get(String(b.id)) ?? -1) - (scores.get(String(a.id)) ?? -1));
    }
    this.pages.add(
      'catalog',
      JSON.stringify({ components: index, standards: catalog.standards }),
      'json',
    );
  }

  /** Separates complete assignment records from the state index; feedback remains exact and retrievable. */
  private state(runId: string, retained: RetainedDirection): void {
    const state = Array.isArray(retained.state)
      ? retained.state.map((assignment, index) => this.assignment(assignment, index))
      : retained.state;
    this.pages.add('state', JSON.stringify({ currentRunId: runId, state }), 'json');
    this.pages.add('feedback', JSON.stringify(retained.feedback ?? null), 'json');
  }

  /** Keeps immediate continuation eligibility visible without inlining command histories or candidate records. */
  private assignment(assignment: any, index: number): unknown {
    const artifact = 'assignment:' + index;
    this.pages.add(artifact, JSON.stringify(assignment), 'json');
    return {
      id: assignment.id,
      runId: assignment.runId,
      owner: assignment.owner,
      status: assignment.status,
      objective: assignment.objective,
      acceptance: assignment.acceptance,
      dependencies: assignment.dependencies,
      continuation: assignment.checkpointEvidence?.continuation,
      artifact,
    };
  }
}
