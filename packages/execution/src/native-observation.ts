import type { AgentInspection } from '../../architecture/src/index.js';
import type { HostTask } from './index.js';
import type { CodexObservation } from './codex-events.js';
import { codex } from './codex.js';

/** Correlate one real provider invocation with its complete request, events and measured duration. */
export class NativeObservation {
  readonly activation: string;
  readonly stderr: string;
  private readonly start = performance.now();

  /** Retain the exact resolved request and attribution before any provider process starts. */
  constructor(
    private readonly task: HostTask,
    private readonly view: AgentInspection,
  ) {
    const request = task.store('native-request.json', JSON.stringify(view.request, null, 2));
    this.activation = task.artifact('codex.jsonl');
    this.stderr = task.artifact('codex.stderr.log');
    task.note({
      nativeStarted: {
        ...actorAttribution(task, view),
        activation: this.activation,
        request,
        stderr: this.stderr,
      },
    });
  }

  /** Persist the complete exposed event before forwarding its durable identity to observers. */
  record(event: CodexObservation) {
    const source =
      event.kind === 'invocation'
        ? this.task.store('native-invocation.json', JSON.stringify(event, null, 2))
        : event.kind === 'stderr'
          ? this.stderr
          : this.activation;
    this.task.note(
      {
        nativeEvent: {
          activation: this.activation,
          kind: event.kind,
          source,
          ...(event.kind === 'event' ? { event: eventMetadata(event.event) } : {}),
        },
      },
      event,
    );
  }

  /** Run the provider once and retain its terminal measurement even when execution fails. */
  async run(schema: string | undefined, url: string, signal: AbortSignal) {
    let failure: unknown;
    try {
      return await codex(this.task.config.executable, this.view, this.activation, signal, {
        schema,
        url,
        stderr: this.stderr,
        observe: (event) => this.record(event),
      });
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      this.finish(failure);
    }
  }

  /** Preserve actual duration and failure without turning an interrupted invocation into success. */
  private finish(failure?: unknown) {
    this.task.note({
      nativeFinished: {
        activation: this.activation,
        stderr: this.stderr,
        durationMs: performance.now() - this.start,
        ...(failure === undefined
          ? {}
          : { failure: failure instanceof Error ? failure.message : String(failure) }),
      },
    });
  }
}

/** Keep accounting/discovery fields in state; complete messages remain in their retained source files. */
function eventMetadata(event: unknown) {
  if (!event || typeof event !== 'object') return undefined;
  const value = event as {
    type?: unknown;
    usage?: unknown;
    item?: { id?: unknown; type?: unknown };
  };
  return {
    type: value.type,
    usage: value.usage,
    ...(value.item ? { item: { id: value.item.id, type: value.item.type } } : {}),
  };
}

/** Name the actual selected profile and model without duplicating the complete retained request. */
function actorAttribution(task: HostTask, view: AgentInspection) {
  return {
    component: view.component,
    activity: view.activity,
    profile: task.capture.components[view.component]?.activities[view.activity]?.profile,
    model: view.request.options.model,
    reasoning: view.request.options.modelReasoningEffort,
    inputBytes: Buffer.byteLength(view.request.input, 'utf8'),
    revision: task.capture.source.revision,
    nodeVersion: process.version,
  };
}
