import type { Capture } from './catalog.js';
import {
  architectureIdentity,
  architecturePatch,
  ArchitectureResponseError,
  type ArchitectureProposal,
} from './proposal.js';
import { amendArchitectureRegistry } from './registry.js';

/** Resolve proposal intent and original bytes exactly once before rendering its approval question. */
export function prepareArchitectureProposal(
  capture: Capture,
  reply: Record<string, unknown>,
  feedback?: string,
): ArchitectureProposal {
  if (reply.baseline !== undefined && reply.baseline !== capture.source.revision)
    throw new ArchitectureResponseError(
      'Proposal baseline must match the current captured revision',
    );
  const purpose = meaningful(reply.purpose, 'purpose');
  const consequences = strings(reply.consequences, 'consequences');
  const implementation = strings(reply.implementation, 'implementation');
  const files = proposalFiles(capture, reply.changes);
  const body = {
    baseline: capture.source.revision,
    purpose,
    feedback,
    consequences,
    implementation,
    files,
  };
  body.files = amendArchitectureRegistry(capture, files, architectureIdentity(body))
    .filter(({ before, content }) => before !== content)
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!body.files.length)
    throw new ArchitectureResponseError(
      'Use a justified no-change assessment when all proposed bytes are unchanged',
    );
  return { id: architectureIdentity(body), ...body };
}

/** Validate the complete path set before reading captured guide contents or deriving registry edits. */
function proposalFiles(capture: Capture, changes: unknown) {
  if (!Array.isArray(changes) || !changes.length)
    throw new ArchitectureResponseError(
      'changes: expected a nonempty array of exact guide contents',
    );
  const files = changes.map((value, index) => {
    if (!value || typeof value !== 'object')
      throw new ArchitectureResponseError(`changes[${index}]: expected an object`);
    const entry = value as Record<string, unknown>;
    return architecturePatch(
      capture,
      meaningful(entry.path, `changes[${index}].path`),
      entry.content,
    );
  });
  if (new Set(files.map(({ path }) => path)).size !== files.length)
    throw new ArchitectureResponseError('changes: duplicate architecture path');
  return files;
}

/** Reject missing intent rather than coercing arbitrary model values into an approval batch. */
function meaningful(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim())
    throw new ArchitectureResponseError(`${path}: expected nonempty text`);
  return value;
}

/** Preserve authored consequence and prerequisite order without accepting partial array values. */
function strings(value: unknown, path: string) {
  if (!Array.isArray(value)) throw new ArchitectureResponseError(`${path}: expected an array`);
  return value.map((entry, index) => meaningful(entry, `${path}[${index}]`));
}
