import type { ObjectiveReview } from '../../../../packages/planner/src/objective-review.js';
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
  operations: Operation[];
};

export interface Operation {
  key: string;
  sequence: string;
  label: string;
  state?: string;
  tool?: string;
  check?: CheckResult;
}

type Observation = {
  message?: string;
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
  operation?: { name?: string; call?: string; phase?: string };
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
  private count = 0;
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
    this.messages.clear();
  }

  /** Route status messages, questions and check results to their shared timeline. */
  private append(frame: TimelineFrame) {
    const observation = frame.observation as Observation | null;
    if (!observation) return;
    const { clarification, message, nativeEvent, outcome } = observation;
    if (clarification?.question) {
      const id = JSON.stringify([clarification.scope, clarification.question]);
      const entry = this.questions.get(id);
      if (entry) entry.question = clarification;
      else this.questions.set(id, this.add(frame, { question: clarification }));
      return;
    }
    const item = nativeEvent?.event?.item;
    const text = item?.type === 'agent_message' ? item.text : undefined;
    if (text) {
      const identity = item?.id && JSON.stringify([nativeEvent?.activation, item.id]);
      const entry = identity && this.messages.get(identity);
      if (entry) entry.message = text;
      else {
        const message = this.add(frame, { message: text });
        if (identity) this.messages.set(identity, message);
      }
      return;
    }
    if (message || outcome) {
      this.add(frame, { message: message ?? outcome?.summary ?? outcome?.reason ?? outcome?.kind });
      return;
    }
    this.addOperation(frame, observation);
  }

  /** Keep a tool's final state at the position where it first appeared. */
  private addOperation(frame: TimelineFrame, observation: Observation) {
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
    };
    this.calls.set(key, entry);
    (this.entries.at(-1) ?? this.add(frame)).operations.push(entry);
  }

  /** Start one status group at the original observation time. */
  private add(frame: TimelineFrame, value: { message?: string; question?: Question } = {}) {
    const entry = { key: frame.sequence, timestamp: frame.timestamp, operations: [], ...value };
    this.entries.push(entry);
    return entry;
  }
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
