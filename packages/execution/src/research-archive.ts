import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { sep } from 'node:path';
import { researchDirectory } from '../../architecture/src/index.js';
import { editFingerprint, type CheckedEdit } from './edits.js';
import type { HostTask } from './index.js';
import type { ResearchResult } from './research.js';
import { StewardResponseError } from './steward-response.js';

/** Expose summaries of reusable reports still available for this owner's checked edits. */
export function pendingResearch(task: HostTask, owner: string) {
  const reports = task.researchReports(owner) as ResearchResult[];
  return reports
    .filter(({ archive }) => archive && !task.capture.source.paths.includes(archive))
    .map(({ request, archive, summary }) => ({ id: request.id, path: archive, summary }));
}

/** Turn an explicit archive selection into ordinary checked edits of the retained bytes. */
export function archiveResearch(task: HostTask, owner: string, ids: readonly string[]) {
  const edits: CheckedEdit[] = [];
  for (const id of ids) {
    const [report] = task.researchReports(owner, id) as ResearchResult[];
    const path = `${researchDirectory(task.capture, owner)}/${id}.md`;
    if (!report || report.archive !== path || !task.worktree)
      throw new StewardResponseError(`No reusable research report for ${owner}: ${id}`);
    const digest = editFingerprint(task.worktree, task.capture, owner, path);
    if (digest === report.digest) continue;
    if (digest !== null) throw new StewardResponseError(`Research archive already exists: ${path}`);
    edits.push({ path, expected: null, content: reportBytes(task, report) });
  }
  return edits;
}

/** Check that the retained bytes are still the original host evidence. */
function reportBytes(task: HostTask, report: ResearchResult) {
  const { evidence, digest } = report;
  if (!evidence.startsWith(task.config.storage + sep) || realpathSync(evidence) !== evidence)
    throw new Error('Research report is outside the trusted application storage path');
  const content = readFileSync(evidence, 'utf8');
  if (createHash('sha256').update(content).digest('hex') !== digest)
    throw new Error('Retained research report no longer matches its recorded digest');
  return content;
}
