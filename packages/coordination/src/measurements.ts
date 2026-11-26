import type { JournalEvent } from './index.js';

const usageFields = [
  'input_tokens',
  'cached_input_tokens',
  'cache_write_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
] as const;

type UsageField = (typeof usageFields)[number];
type Usage = Record<UsageField, { reported: number | null; missingTurns: number }>;

interface Profile {
  profile: string | null;
  model: string | null;
  reasoning: string | null;
  activations: number;
  finishedActivations: number;
  failedActivations: number;
  incompleteActivations: number;
  activationsWithoutUsage: number;
  durationMs: number;
  usage: Usage;
}

interface Activation {
  run: number;
  profile: Profile;
  startedAt: number | null;
  usageObserved: boolean;
}

interface NativeRecord {
  nativeStarted?: { activation: string; profile?: string; model?: string; reasoning?: string };
  nativeEvent?: {
    activation: string;
    kind: string;
    event?: { type?: string; usage?: Partial<Record<UsageField, unknown>> };
  };
  nativeFinished?: { activation: string; durationMs: number; failure?: unknown };
  nativeInvocation?: unknown;
  invocation?: { startedAt: string };
  outcome?: unknown;
}

type MeasuredAttempt = { run: number; startedAt: number; lastAt: number; ended: boolean };

/** Derive live or replayed accounting from canonical events without another persistent store or budget. */
export class RunMeasurements {
  private readonly profiles = new Map<string, Profile>();
  private readonly active = new Map<string, Activation>();
  private sequence?: bigint;
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private attempt?: MeasuredAttempt;
  private priorProcessingMs = 0;
  private historicalUnmeasuredActivations = 0;

  /** Optionally expose a cumulative snapshot at each actual provider usage report. */
  constructor(private readonly report?: (frame: JournalEvent, usage: Usage) => void) {}

  /** Consume ordered durable events once, retaining missing measurements as unknown. */
  accept(frame: JournalEvent) {
    const sequence = BigInt(frame.sequence);
    if (this.sequence !== undefined && sequence <= this.sequence) return false;
    this.sequence = sequence;
    const at = frame.timestamp === null ? null : Date.parse(frame.timestamp);
    const record = frame.observation as NativeRecord | null;
    this.measureWall(frame, at, record);
    if (record?.nativeInvocation) this.historicalUnmeasuredActivations++;
    if (record?.nativeStarted) this.start(record.nativeStarted, at, frame.run);
    if (record?.nativeEvent?.event?.type === 'turn.completed' && this.usage(record.nativeEvent))
      this.report?.(frame, totalUsage([...this.profiles.values()].map(({ usage }) => usage)));
    if (record?.nativeFinished) this.finish(record.nativeFinished);
    if (record?.outcome) this.interrupt(frame.run);
    return true;
  }

  /** Preserve the calendar span and measure processing only during foreground attempts. */
  private measureWall(frame: JournalEvent, at: number | null, record: NativeRecord | null) {
    if (this.startedAt === null && at !== null) this.startedAt = at;
    if (frame.parent !== undefined || at === null) return;
    const invoked = record?.invocation ? Date.parse(record.invocation.startedAt) : at;
    const start = Number.isFinite(invoked) ? Math.min(at, invoked) : at;
    this.startedAt = Math.min(this.startedAt ?? start, start);
    if (this.attempt?.run !== frame.run) {
      if (this.attempt) this.priorProcessingMs += this.attempt.lastAt - this.attempt.startedAt;
      this.attempt = { run: frame.run, startedAt: start, lastAt: at, ended: false };
      this.endedAt = null;
    }
    if (this.attempt.ended) return;
    this.attempt.startedAt = Math.min(this.attempt.startedAt, start);
    this.attempt.lastAt = at;
    if (record?.outcome) {
      this.attempt.ended = true;
      this.endedAt = at;
    }
  }

  /** Render an independent current snapshot with inclusive native time separated from run wall time. */
  snapshot(now = Date.now()) {
    const profiles = [...this.profiles.values()].map((profile) =>
      this.profileSnapshot(profile, now),
    );
    const observedNativeElapsedMs = profiles.reduce(
      (sum, profile) => sum + profile.observedElapsedMs,
      0,
    );
    return {
      wallElapsedMs: this.startedAt === null ? null : (this.endedAt ?? now) - this.startedAt,
      processingElapsedMs: this.processingElapsed(now),
      nativeElapsedMs: profiles.some((profile) => profile.elapsedMs === null)
        ? null
        : observedNativeElapsedMs,
      observedNativeElapsedMs,
      usage: totalUsage(profiles.map(({ usage }) => usage)),
      historicalUnmeasuredActivations: this.historicalUnmeasuredActivations,
      cost: { estimate: null, reason: 'No verified pricing or billing basis was supplied' },
      profiles,
    };
  }

  /** Add the current attempt to completed processing spans without counting the gaps. */
  private processingElapsed(now: number) {
    const attempt = this.attempt;
    return attempt
      ? this.priorProcessingMs + (attempt.ended ? attempt.lastAt : now) - attempt.startedAt
      : null;
  }

  /** Attribute each activation to the exact alias, resolved model and reasoning configuration. */
  private start(start: NonNullable<NativeRecord['nativeStarted']>, at: number | null, run: number) {
    const profile = start.profile ?? null;
    const model = start.model ?? null;
    const reasoning = start.reasoning ?? null;
    const key = JSON.stringify([profile, model, reasoning]);
    let record = this.profiles.get(key);
    if (!record) {
      record = {
        profile,
        model,
        reasoning,
        activations: 0,
        finishedActivations: 0,
        failedActivations: 0,
        incompleteActivations: 0,
        activationsWithoutUsage: 0,
        durationMs: 0,
        usage: emptyUsage(),
      };
      this.profiles.set(key, record);
    }
    record.activations++;
    this.active.set(start.activation, {
      run,
      profile: record,
      startedAt: at,
      usageObserved: false,
    });
  }

  /** Account for each reported category independently; cached and reasoning subsets are never added twice. */
  private usage(event: NonNullable<NativeRecord['nativeEvent']>) {
    const active = this.active.get(event.activation);
    if (!active) return;
    active.usageObserved = true;
    for (const key of usageFields) {
      const value = event.event?.usage?.[key];
      const tally = active.profile.usage[key];
      if (typeof value === 'number' && Number.isFinite(value))
        tally.reported = (tally.reported ?? 0) + value;
      else tally.missingTurns++;
    }
    return event.event?.usage != null;
  }

  /** Retain actual failures and explicitly count invocations whose provider supplied no usage. */
  private finish(end: NonNullable<NativeRecord['nativeFinished']>) {
    const active = this.active.get(end.activation);
    if (!active) return;
    active.profile.finishedActivations++;
    if (end.failure !== undefined) active.profile.failedActivations++;
    if (!active.usageObserved) active.profile.activationsWithoutUsage++;
    active.profile.durationMs += end.durationMs;
    this.active.delete(end.activation);
  }

  /** Close only this terminated attempt's unfinished observations without inventing provider completion or duration. */
  private interrupt(run: number) {
    for (const [id, active] of this.active) {
      if (active.run !== run) continue;
      active.profile.incompleteActivations++;
      if (!active.usageObserved) active.profile.activationsWithoutUsage++;
      this.active.delete(id);
    }
  }

  /** Include ongoing activation time without mutating or double-counting completed observations. */
  private profileSnapshot(profile: Profile, now: number) {
    const active = [...this.active.values()].filter((entry) => entry.profile === profile);
    const running = active.reduce(
      (sum, entry) => sum + (entry.startedAt === null ? 0 : now - entry.startedAt),
      0,
    );
    const unknownActiveDurations = active.filter(({ startedAt }) => startedAt === null).length;
    const observedElapsedMs = profile.durationMs + running;
    return {
      ...profile,
      usage: totalUsage([profile.usage]),
      activeActivations: active.length,
      elapsedMs: profile.incompleteActivations || unknownActiveDurations ? null : observedElapsedMs,
      observedElapsedMs,
      unknownActiveDurations,
    };
  }
}

/** Keep the provider's separate accounting fields with explicit unreported values. */
function emptyUsage(): Usage {
  return Object.fromEntries(
    usageFields.map((field) => [field, { reported: null, missingTurns: 0 }]),
  ) as Usage;
}

/** Compute totals from per-profile observations instead of maintaining a duplicate mutable aggregate. */
function totalUsage(values: readonly Usage[]): Usage {
  const result = emptyUsage();
  for (const value of values)
    for (const field of usageFields) {
      const tally = value[field];
      if (tally.reported !== null)
        result[field].reported = (result[field].reported ?? 0) + tally.reported;
      result[field].missingTurns += tally.missingTurns;
    }
  return result;
}
