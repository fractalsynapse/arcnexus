export type ExternalMode = 'live' | 'simulation';

export interface LifecycleEnvironment {
  id: string;
  mode: ExternalMode;
  repositoryId: string;
  providerId: string;
  authorityDigest: string;
}

export interface ExternalIntent {
  id: string;
  environmentId: string;
  runId: string;
  assignmentId?: string;
  operation: string;
  target: string;
  definitionDigest: string;
  input: Record<string, unknown>;
}

export interface ExternalEffect extends ExternalIntent {
  inputDigest: string;
  status: 'prepared' | 'uncertain' | 'completed' | 'rejected';
  attempt: number;
  result?: Record<string, unknown>;
  reason?: string;
}

export type ExternalObservation =
  | { status: 'absent'; evidence: string }
  | { status: 'unknown'; evidence: string; reason?: string }
  | { status: 'completed'; evidence: string; result: Record<string, unknown> }
  | { status: 'rejected'; evidence: string; reason: string };
