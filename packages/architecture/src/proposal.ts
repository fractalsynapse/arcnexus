import { textDigest, type ContentPatch } from '../../foundation/src/index.js';
import type { Capture } from './catalog.js';
import { InvalidAgentResponse } from '../../agent/src/index.js';
import type { ActivityOutcome } from '../../workflow/src/index.js';

export interface ArchitectureProposal {
  id: string;
  baseline: string;
  purpose: string;
  feedback?: string;
  consequences: string[];
  implementation: string[];
  files: ContentPatch[];
}

export type ArchitectureDecision =
  | { kind: 'no-change'; summary: string; evidence: readonly string[] }
  | { kind: 'approved'; proposal: ArchitectureProposal; report: string }
  | (Extract<ActivityOutcome, { kind: 'supplier' }> & { scope: string });

/** Distinguish a rejected model proposal from source, execution or human gate failures. */
export class ArchitectureResponseError extends InvalidAgentResponse {}

/** Identify exact guide content and intent without trusting a model-supplied identity. */
export function architectureIdentity(proposal: Omit<ArchitectureProposal, 'id'>) {
  const { baseline, purpose, feedback, consequences, implementation, files } = proposal;
  return textDigest(
    JSON.stringify({ baseline, purpose, feedback, consequences, implementation, files }),
  );
}

/** Resolve original bytes from captured authority and refuse implementation disguised as a guide. */
export function architecturePatch(capture: Capture, path: string, content: unknown): ContentPatch {
  const parts = path.split('/');
  if (
    parts.some(
      (part) => !part || part === '.' || part === '..' || part === '.git' || /[\\\0]/.test(part),
    )
  )
    throw new ArchitectureResponseError(`Unsafe architecture path: ${path}`);
  if (!guidePath(capture, path))
    throw new ArchitectureResponseError(
      `Architecture proposals contain guides, not implementation or another owner's files: ${path}`,
    );
  if (typeof content !== 'string' && content !== null)
    throw new ArchitectureResponseError(`Invalid architecture content: ${path}`);
  return {
    path,
    before: capture.source.paths.includes(path) ? capture.source.read(path) : null,
    content,
  };
}

/** Classify reviewable guide source while excluding implementation and foreign ordinary documents. */
function guidePath(capture: Capture, path: string) {
  const owner = capture.project.architect?.component;
  const owned = capture.components[owner ?? '']?.owns.some(
    (root) => path === root || path.startsWith(root + '/'),
  );
  return (
    capture.contracts.some((entry) => entry.file === path) ||
    path === capture.project.contractRegistry ||
    Object.values(capture.standards ?? {}).some((entry) => entry.document === path) ||
    Boolean(owned && /\.(?:md|ya?ml)$/.test(path))
  );
}
