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

/** Derive live or replayed accounting from canonical events without another persistent store or budget. */
export class RunMeasurements {
  private readonly profiles = new Map<string, Profile>();
  private readonly active = new Map<string, Activation>();
  private sequence?: bigint;
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private historicalUnmeasuredActivations = 0;

  /** Consume ordered durable events once, retaining missing measurements as unknown. */
  accept(frame: JournalEvent) {
    const sequence = BigInt(frame.sequence);
    if (this.sequence !== undefined && sequence <= this.sequence) return false;
    this.sequence = sequence;
    const at = frame.timestamp === null ? null : Date.parse(frame.timestamp);
    if (this.startedAt === null && at !== null) this.startedAt = at;
    const record = frame.observation as NativeRecord | null;
    if (record?.invocation) this.startedAt = Date.parse(record.invocation.startedAt);
    this.endedAt = record?.outcome && frame.parent === undefined ? at : null;
    if (record?.nativeInvocation) this.historicalUnmeasuredActivations++;
    if (record?.nativeStarted) this.start(record.nativeStarted, at, frame.run);
    if (record?.nativeEvent?.event?.type === 'turn.completed') this.usage(record.nativeEvent);
    if (record?.nativeFinished) this.finish(record.nativeFinished);
    if (record?.outcome) this.interrupt(frame.run);
    return true;
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
