import {
  objectiveReviewLabel,
  objectiveReviewReady,
  type ObjectiveReview,
} from '../../../../packages/planner/src/objective-review.js';
import type { TimelineFrame } from './timeline-stream.js';
import { AttemptWindow } from '../../../../packages/coordination/src/attempt-window.js';

export type CheckResult = { id: string; status?: number | string; diagnostic?: string };
export type Question = {
  scope?: string;
  question: string;
  answer?: string;
  review?: ObjectiveReview;
};

export type TimelineEntry = {
  key: string;
  timestamp: string | null;
  message?: string;
  question?: Question;
  actor?: ActivityAttribution;
  operations: Operation[];
};

export interface ActivityAttribution {
  component: string;
  activity: string;
}

type ObservedActor = Partial<ActivityAttribution>;
type MessageOrQuestion = Pick<TimelineEntry, 'message' | 'question' | 'actor'>;

export interface Operation {
  key: string;
  sequence: string;
  label: string;
  state?: string;
  tool?: string;
  check?: CheckResult;
  actor?: ActivityAttribution;
}

type Observation = {
  phase?: string;
  message?: string;
  onboardingSelection?: { drafts: { title: string }[] };
  nativeStarted?: ObservedActor & { activation: string };
  nativeEvent?: {
    activation?: string;
    event?: {
      item?: {
        id?: string;
        type?: string;
        tool?: string;
        text?: string;
        status?: string;
        exit_code?: number;
      };
    };
  };
  operation?: ObservedActor & { name?: string; call?: string; phase?: string };
  scope?: { owner?: string; activity?: string };
  actor?: ObservedActor;
  check?: CheckResult;
  clarification?: Question;
  outcome?: { kind?: string; reason?: string; summary?: string };
};

/** Incrementally group committed frames as the same retained stream grows. */
class TimelineProjection {
  readonly entries: TimelineEntry[] = [];
  private readonly calls = new Map<string, Operation>();
  private readonly questions = new Map<string, TimelineEntry>();
  private readonly messages = new Map<string, TimelineEntry>();
  private readonly activations = new Map<string, ActivityAttribution>();
  private count = 0;
  private retainedDrafts?: { title: string }[];
  private readonly window = new AttemptWindow();

  /** Process every new observation once, retaining its display position. */
  update(frames: readonly TimelineFrame[], execution?: string, expected?: string) {
    for (const frame of frames.slice(this.count)) {
      if (this.window.advance(frame, execution)) this.reset();
      this.append(frame);
    }
    this.count = frames.length;
    return this.window.includes(expected) ? this.entries : [];
  }

  /** Reset after a completed attempt and preserve context across an approval pause. */
  private reset() {
    this.entries.length = 0;
    this.calls.clear();
    this.questions.clear();
    this.retainedDrafts = undefined;
    this.messages.clear();
    this.activations.clear();
  }

  /** Route status messages, questions and check results to their shared timeline. */
  private append(frame: TimelineFrame) {
    const observation = frame.observation as Observation | null;
    if (!observation || objectiveReviewNotice(observation)) return;
    const { clarification, message, outcome, onboardingSelection, nativeStarted } = observation;
    if (nativeStarted) {
      const actor = observedActor(nativeStarted);
      if (actor) this.activations.set(nativeStarted.activation, actor);
    }
    const actor = this.attribution(observation);
    if (clarification?.question) return this.addQuestion(frame, clarification, actor);
    if (onboardingSelection?.drafts?.length) {
      this.retainedDrafts = onboardingSelection.drafts;
      return;
    }
    if (this.addNativeMessage(frame, observation.nativeEvent, actor)) return;
    if (message || outcome) {
      this.add(frame, { actor, message: message ?? outcomeMessage(outcome, this.retainedDrafts) });
      return;
    }
    this.addOperation(frame, observation, actor);
  }

  /** Attribute observations from the captured activation or the operation's explicit scope. */
  private attribution({ nativeEvent, nativeStarted, operation, scope, actor }: Observation) {
    if (nativeEvent?.activation) return this.activations.get(nativeEvent.activation);
    return observedActor(
      actor ?? operation ?? nativeStarted ?? { component: scope?.owner, activity: scope?.activity },
    );
  }

  /** Update streaming text without moving it out of its original activation and timeline group. */
  private addNativeMessage(
    frame: TimelineFrame,
    nativeEvent: Observation['nativeEvent'],
    actor?: ActivityAttribution,
  ) {
    const item = nativeEvent?.event?.item;
    const text = item?.type === 'agent_message' ? item.text : undefined;
    if (!text) return false;
    const identity = item?.id && JSON.stringify([frame.run, nativeEvent?.activation, item.id]);
    const entry = identity && this.messages.get(identity);
    if (entry) entry.message = text;
    else {
      const message = this.add(frame, { message: text, actor });
      if (identity) this.messages.set(identity, message);
    }
    return true;
  }

  /** Update a question in place when its journaled decision arrives. */
  private addQuestion(frame: TimelineFrame, clarification: Question, actor?: ActivityAttribution) {
    const id =
      clarification.review?.id ?? JSON.stringify([clarification.scope, clarification.question]);
    const entry = this.questions.get(id);
    if (entry) {
      entry.question = clarification;
      entry.actor ??= actor;
    } else this.questions.set(id, this.add(frame, { question: clarification, actor }));
  }

  /** Keep a tool's final state at the position where it first appeared. */
  private addOperation(
    frame: TimelineFrame,
    observation: Observation,
    actor?: ActivityAttribution,
  ) {
    const { operation, check, nativeEvent } = observation;
    const item = nativeEvent?.event?.item;
    const builtin = item?.type === 'command_execution' || item?.type === 'web_search';
    if (!operation?.name && !check?.id && !builtin) return;
    const call = operation?.call ?? (builtin ? item?.id : undefined);
    const key = call ? JSON.stringify([frame.run, call, nativeEvent?.activation]) : frame.sequence;
    const prior = this.calls.get(key);
    const state = operation?.phase ?? (item?.exit_code ? 'failed' : item?.status);
    if (prior) {
      prior.state = state;
      return;
    }
    const entry = {
      key,
      sequence: frame.sequence,
      label: operation?.name ?? check?.id ?? item!.type!,
      state,
      tool: operation?.name,
      check,
      actor,
    };
    this.calls.set(key, entry);
    (this.entries.at(-1) ?? this.add(frame)).operations.push(entry);
  }

  /** Start one status group at the original observation time. */
  private add(frame: TimelineFrame, value: MessageOrQuestion = {}) {
    const entry = { key: frame.sequence, timestamp: frame.timestamp, operations: [], ...value };
    this.entries.push(entry);
    return entry;
  }
}

function observedActor(actor: ObservedActor): ActivityAttribution | undefined {
  return actor.component && actor.activity
    ? { component: actor.component, activity: actor.activity }
    : undefined;
}

function objectiveReviewNotice({ phase, message, outcome }: Observation) {
  return (
    (phase === 'question' && message === objectiveReviewReady) ||
    (outcome?.kind === 'blocked' && outcome.reason === objectiveReviewLabel + '.')
  );
}

function outcomeMessage(outcome: Observation['outcome'], drafts?: { title: string }[]) {
  if (outcome?.kind === 'planned' && drafts) return retainedMessage(drafts);
  return outcome?.summary ?? outcome?.reason ?? outcome?.kind;
}

function retainedMessage(drafts: { title: string }[]) {
  return drafts.length === 1
    ? `Retained objective draft “${drafts[0]!.title}”.`
    : `Retained ${drafts.length} objective drafts.`;
}

const projections = new WeakMap<readonly TimelineFrame[], TimelineProjection>();

export function groupTimeline(
  frames: readonly TimelineFrame[],
  execution?: string,
  expected?: string,
) {
  let projection = projections.get(frames);
  if (!projection) {
    projection = new TimelineProjection();
    projections.set(frames, projection);
  }
  return projection.update(frames, execution, expected);
}
