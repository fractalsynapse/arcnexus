import { RunMeasurements, type JournalEvent } from '../../coordination/src/index.js';
import type {
  Observation,
  RoundOutcome,
  TaskObserver,
  TaskQuestion,
  TaskSession,
} from './services.js';

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

  /** Bind each session's questions and retain the original foreground entry time. */
  admittedSession(session: TaskSession) {
    session.ask = (question, signal, gate) => {
      const prompt = { phase: 'question' as const, message: question };
      session.record(prompt);
      if (!session.listen) this.progress(prompt);
      signal.throwIfAborted();
      return this.answer(question, signal, gate);
    };
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

  /** Let a durable adapter checkpoint the accepted round before the journal closes it. */
  async completeRound(outcome: RoundOutcome) {
    await this.caller.completeRound?.(outcome);
  }

  /** Keep human interaction with the original foreground caller. */
  answer(question: string, signal: AbortSignal, gate?: TaskQuestion) {
    return this.caller.answer?.(question, signal, gate) ?? Promise.resolve(undefined);
  }
}
