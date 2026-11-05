import type { RunEnvironment } from './execution-types.js';

/** Captures the original steward branch and its independently verified contribution. */
export interface DevelopmentDelivery {
  assignmentId: string;
  owner: string;
  recordId: string;
  branch: string;
  base: string;
  candidate: string;
}

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
  candidateRecordId?: string;
  verification: { references: string[]; digest: string };
  target: { repository: string; branch: string };
  promotedFrom?: string;
  developments?: DevelopmentDelivery[];
  development?: DevelopmentDelivery;
  parentDeliveryId?: string;
}

/** Fresh target workspace and goal evidence retained separately from the source simulation's assignments. */
export interface PromotionCandidate {
  record: Record<string, unknown>;
  goalEvidence: string[];
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
