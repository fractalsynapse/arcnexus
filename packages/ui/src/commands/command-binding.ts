import type { ObjectiveReview } from '../../../planner/src/objective-review.js';
import type { TokenUsage } from '../content/token-pair.js';

export const operations = {
  plan: 'Plan',
  architect: 'Architect',
  run: 'Run',
  steer: 'Steer',
} as const;

export type Operation = keyof typeof operations;

export interface CommandRequest {
  operation: Operation;
  instruction: string;
  workspace: string;
  recommendObjectives?: boolean;
}

export interface CommandState {
  status: 'Unavailable' | 'Idle' | 'Active' | 'Waiting' | 'Failed' | 'Completed' | 'Cancelled';
  scope?: string;
  gate?: { id: string; key: string; question: string; review?: ObjectiveReview };
  canRecommendObjectives?: boolean;
  recommendationOnly?: boolean;
  canReconnect?: boolean;
  canCancel?: boolean;
  supported: readonly Operation[];
  requestId?: string;
  command?: string;
  execution?: string;
  metrics?: ReadonlyArray<readonly [label: string, value: string | TokenUsage]>;
}

export interface CommandBinding {
  getSnapshot(): CommandState;
  subscribe(listener: () => void): () => void;
  submit?(request: CommandRequest): Promise<void>;
  answer?(gate: string, answer: string): Promise<void>;
  refine?(): Promise<void>;
  cancel?(): Promise<void>;
  reconnect?(): void;
}
