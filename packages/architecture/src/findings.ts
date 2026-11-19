import type { HostTask } from '../../execution/src/index.js';

/** Retain complete observations once and give the Architect their readable artifact reference. */
export function architectureFindings(task: HostTask) {
  return task.store('architecture-findings.json', JSON.stringify(task.journal.findings(), null, 2));
}
