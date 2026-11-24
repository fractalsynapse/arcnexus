import type { ReactNode } from 'react';
import type { ColumnCount } from './page-preferences.js';

export interface DisplayRegistration {
  id: string;
  label: string;
  content: ReactNode;
  defaultColumn?: number;
}

export interface Workspace {
  path: string;
  label: string;
  content?: ReactNode;
  headerAction?: ReactNode;
  defaultColumns?: ColumnCount;
  displays?: readonly DisplayRegistration[];
}

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
  status: 'Unavailable' | 'Idle' | 'Active' | 'Waiting' | 'Failed';
  supported: readonly Operation[];
  command?: string;
  metrics?: ReadonlyArray<readonly [label: string, value: string]>;
}

export interface CommandBinding {
  getSnapshot(): CommandState;
  subscribe(listener: () => void): () => void;
  submit?(request: CommandRequest): Promise<void>;
}
