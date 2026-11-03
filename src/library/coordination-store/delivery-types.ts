import type { RunEnvironment } from './execution-types.js';

/** Immutable attribution and verification captured before publication authority is considered. */
export interface DeliveryCapture {
  id: string;
  projectId: string;
  packageId: string;
  runId: string;
  assignmentIds: string[];
  environment: RunEnvironment;
  authorityDigest: string;
  base: string;
  candidate: string;
  verification: { references: string[]; digest: string };
  target: { repository: string; branch: string };
  promotedFrom?: string;
}

/** Separates verified engineering, Git delivery, integration and release outcomes. */
export interface DeliveryRecord extends DeliveryCapture {
  version: number;
  createdAt: string;
  engineering: 'verified';
  delivery: 'retained' | 'committed' | 'pushed';
  integration: 'not_requested' | 'pending' | 'merged';
  publication: 'not_requested' | 'released';
  approval?: { candidate: string; authorizedAt: string };
  receipts: Partial<Record<DeliveryMilestone, string>>;
  blocker?: string;
}

export type DeliveryMilestone = 'commit' | 'push' | 'pull_request' | 'merge' | 'release';
