import type { SQLOutputValue, SQLInputValue, StatementSync } from 'node:sqlite';

export type JournalValue = SQLInputValue;
export type JournalRow = Record<string, SQLOutputValue>;
export type JournalStatement = Pick<StatementSync, 'all' | 'get' | 'run'>;
export type JournalReader = { prepare(sql: string): JournalStatement };

/** Storage operations used by the single journal lifecycle. */
export interface JournalStore extends JournalReader {
  readonly key: string;
  readonly signal?: AbortSignal;
  holder(): string;
  canReclaim(lease: unknown): boolean;
  guard(run?: number): void;
  exec(sql: string): void;
  close(): void;
}

export interface JournalBackend {
  key(remote: string): string;
  open(remote: string): JournalStore;
}
