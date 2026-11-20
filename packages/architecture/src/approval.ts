import { unifiedDiff } from '../../foundation/src/index.js';
import type { ArchitectureProposal } from './proposal.js';

export interface ArchitectureRecord {
  proposal: ArchitectureProposal;
  report: string;
}

/** Render the complete immutable batch that a human reviews before any protected application. */
export function architectureQuestion(proposal: ArchitectureProposal) {
  return [
    `Architecture proposal ${proposal.id}`,
    `Baseline: ${proposal.baseline}`,
    proposal.feedback === undefined ? '' : `Feedback: ${proposal.feedback}`,
    `Purpose: ${proposal.purpose}`,
    `Consequences:\n${proposal.consequences.map((text) => `- ${text}`).join('\n')}`,
    `Implementation outcomes:\n${proposal.implementation.map((text) => `- ${text}`).join('\n') || 'None'}`,
    ...proposal.files.map(unifiedDiff),
    'Reply approve to delegate this exact batch to the trusted host, or skip to decline.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Keep model questions outside the host approval scope, even when their visible text is identical. */
export function architectureGate(proposal: ArchitectureProposal) {
  return `Host architecture approval ${proposal.id} at ${proposal.baseline}`;
}
