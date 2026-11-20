import { RunMeasurements, type JournalEvent } from '../../coordination/src/index.js';
import type { Observation, TaskObserver, TaskSession } from './services.js';

/** Project one invocation's existing event stream into transport-neutral live measurements. */
export class RunObserver implements TaskObserver {
  private readonly projection = new RunMeasurements();
  private readonly startedAt = new Date().toISOString();
  private admitted = false;

  /** Retain the caller's output and question handlers without a separate event store. */
  constructor(private readonly caller: TaskObserver) {}

  /** Reuse the foreground projection across sequential phases and goals. */
  static for(observer: TaskObserver) {
    return observer instanceof RunObserver ? observer : new RunObserver(observer);
  }

  /** Persist foreground entry time once admission succeeds, including time spent preparing admission. */
  admittedSession(session: TaskSession) {
    if (this.admitted) return;
    this.admitted = true;
    session.record({ invocation: { startedAt: this.startedAt } });
  }

  /** Forward observations that occur outside an admitted journal. */
  progress(observation: Observation) {
    this.caller.progress(observation);
  }

  /** Return the existing event-derived projection without estimating unknown values. */
  measurementSnapshot() {
    return this.projection.snapshot();
  }

  /** Forward every durable event, legacy progress when needed, and updated measured totals. */
  event(frame: JournalEvent) {
    const changed = this.projection.accept(frame);
    this.caller.event?.(frame);
    const observation = frame.observation as Partial<Observation> | null;
    if (!this.caller.event && observation?.phase && typeof observation.message === 'string')
      this.caller.progress(observation as Observation);
    if (changed) this.caller.measurements?.(this.projection.snapshot());
  }

  /** Keep human interaction with the original foreground caller. */
  answer(question: string, signal: AbortSignal) {
    return this.caller.answer?.(question, signal) ?? Promise.resolve(undefined);
  }
}
