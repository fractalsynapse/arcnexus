import {
  architectureGate,
  architectureIdentity,
  architectureQuestion,
  type ArchitectureRecord,
  type ArchitectureProposal,
} from '../../architecture/src/index.js';
import { textDigest } from '../../foundation/src/index.js';
import type { HostTask } from './index.js';
import { protectedFingerprint, replaceProtected, StaleCheckedEdit } from './edits.js';
import { reconcileCheckpoint, saveCheckpoint } from './checkpoint.js';

/** Recover a host-owned approval from the actual ancestor, never from candidate-supplied permission data. */
export function approvedArchitecture(task: HostTask, id: string) {
  const parent = task.parent;
  const record = parent
    ?.observations<{ architectureProposal?: ArchitectureRecord }>()
    .findLast(
      ({ architectureProposal }) => architectureProposal?.proposal.id === id,
    )?.architectureProposal;
  if (!parent || !record || task.journal.parent !== parent.journal.run)
    throw new Error('Architecture delivery requires its admitted approval parent');
  const proposal = record.proposal;
  const selection = parent.capture.project.architect;
  if (!selection || proposal.id !== architectureIdentity(proposal))
    throw new Error('The exact architecture proposal changed');
  const receipt = parent.decisionRecord(
    selection,
    architectureGate(proposal),
    architectureQuestion(proposal),
  );
  if (receipt?.answer.trim().toLowerCase() !== 'approve')
    throw new Error('Architecture delivery requires the exact human approval receipt');
  if (
    proposal.baseline !== task.capture.source.revision ||
    proposal.baseline !== parent.capture.source.revision
  )
    throw new Error('Architecture proposal baseline changed; renewed approval is required');
  return { ...record, receipt: receipt.evidence };
}

/** Apply exact protected bytes after prerequisites while preserving each acknowledged file checkpoint. */
export async function applyArchitecture(task: HostTask, id: string, signal: AbortSignal) {
  const { proposal, receipt } = approvedArchitecture(task, id);
  if (!task.worktree || !task.branch)
    throw new Error('Architecture application requires an issue worktree');
  await reconcileCheckpoint(task, signal);
  const pending = architectureFiles(task, proposal);
  for (const { file, before, after } of pending) {
    signal.throwIfAborted();
    replaceProtected(
      task.worktree,
      { path: file.path, expected: before, content: file.content },
      () => task.note({ architectureWrite: { id, receipt, path: file.path, before, after } }),
    );
    saveCheckpoint(task);
    await reconcileCheckpoint(task, signal);
  }
}

interface ArchitectureWrite {
  architectureWrite?: {
    id: string;
    receipt: string;
    path: string;
    before: string | null;
    after: string | null;
  };
}

/** Validate protected checkpoint contents against the original approved file and host write intent. */
export function architectureCheckpoint(task: HostTask, path: string, after: string | null) {
  const event = task
    .observations<ArchitectureWrite>()
    .findLast(
      ({ architectureWrite }) =>
        architectureWrite?.path === path && architectureWrite.after === after,
    )?.architectureWrite;
  if (!event) return false;
  const { proposal, receipt } = approvedArchitecture(task, event.id);
  const file = proposal.files.find((entry) => entry.path === path);
  return Boolean(
    file &&
    receipt === event.receipt &&
    (file.content === null ? null : textDigest(file.content)) === after,
  );
}

/** Validate the entire protected batch before its first write and recognize only journaled replayed files. */
function architectureFiles(task: HostTask, proposal: ArchitectureProposal) {
  return proposal.files.flatMap((file) => {
    const before = file.before === null ? null : textDigest(file.before);
    const after = file.content === null ? null : textDigest(file.content);
    const actual = protectedFingerprint(task.worktree!, file.path);
    const intended = task
      .observations<ArchitectureWrite>()
      .some(
        ({ architectureWrite }) =>
          architectureWrite?.id === proposal.id &&
          architectureWrite.path === file.path &&
          architectureWrite.before === before &&
          architectureWrite.after === after,
      );
    if (actual === after && intended) return [];
    if (actual !== before) throw new StaleCheckedEdit(file.path, actual);
    return [{ file, before, after }];
  });
}
