export interface JournalEvent {
  sequence: string;
  run: number;
  taskID: string;
  goalID: string;
  parent?: number;
  timestamp: string | null;
  observation: unknown;
  detail?: unknown;
}

export interface RetainedRun {
  run: number;
  events: readonly unknown[];
}
