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
}

export interface CommandState {
  status: 'Unavailable' | 'Idle' | 'Active' | 'Waiting' | 'Failed' | 'Completed' | 'Cancelled';
  scope?: string;
  gate?: { id: string; key: string; question: string };
  connectionError?: string;
  canReconnect?: boolean;
  canCancel?: boolean;
  supported: readonly Operation[];
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
