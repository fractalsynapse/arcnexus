/** The outcome of one assembled verification: status, evidence references and captured artifacts. */
export interface CheckResult {
  status: 'passed' | 'failed';
  evidence: string[];
  artifacts: Array<{ path: string; sha256: string }>;
}
