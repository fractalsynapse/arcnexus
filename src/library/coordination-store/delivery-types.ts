import type { RunEnvironment } from './execution-types.js';

export interface PublicationDocument {
  title: string;
  body: string;
  template?: { path: string; revision: string; sha256: string };
}

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
  publicationDocument?: PublicationDocument;
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
  developments?: DevelopmentDelivery[];
  development?: DevelopmentDelivery;
  parentDeliveryId?: string;
}

/**
 * The recorded outcome of one publication route.
 *
 * The provider performs the merge and returns its identity; that identity is written once here and
 * every other view — integrated, released, still open — derives from it, instead of three status
 * columns and a receipt map all claiming the same fact (delivery contract I6).
 */
export interface DeliveryRoute {
  /** head: the provider-returned merge identity. */
  head: string;

  /** receipt: the durable effect that produced it, kept so recovery can reconcile. */
  receipt: string;

  /** integratedAt: when the target actually moved. */
  integratedAt: string;

  /** released: whether this route's provider also recorded a release. */
  released: boolean;

  /**
   * releaseExpected: whether the route that produced this merge declared a release step.
   *
   * Recorded from the operating route's own declared operations rather than inferred from the
   * environment, because branching on provider identity would make one goal mean two things.
   */
  releaseExpected: boolean;
}

/** Separates verified engineering from the one recorded publication outcome. */
export interface DeliveryRecord extends DeliveryCapture {
  version: number;
  createdAt: string;
  engineering: 'verified';
  route?: DeliveryRoute;
  approval?: { candidate: string; authorizedAt: string };
  receipts: Partial<Record<DeliveryMilestone, string>>;
  blocker?: string;
}

export type DeliveryMilestone = 'commit' | 'push' | 'pull_request' | 'merge' | 'release';

/** The legacy status vocabulary, computed from the one recorded route. */
export function deliveryStatus(delivery: DeliveryRecord): {
  delivery: 'retained' | 'committed' | 'pushed';
  integration: 'not_requested' | 'pending' | 'merged';
  publication: 'not_requested' | 'released';
} {
  return {
    delivery: delivery.receipts.push
      ? 'pushed'
      : delivery.receipts.commit
        ? 'committed'
        : 'retained',
    integration: delivery.route
      ? 'merged'
      : delivery.receipts.pull_request
        ? 'pending'
        : 'not_requested',
    publication: delivery.route?.released ? 'released' : 'not_requested',
  };
}

/**
 * True when the delivery's publication route has reached its recorded end.
 *
 * The route is complete once the provider's merge identity is recorded and, where that route
 * declared a release step, the release has been captured. Derived from the recorded route alone,
 * never from the environment: branching on namespace here would let the same goal mean two different
 * things, which the collaboration and delivery contracts forbid. This is the one place that question
 * is asked.
 */
export function routeComplete(delivery: DeliveryRecord): boolean {
  return !!delivery.route && (!delivery.route.releaseExpected || delivery.route.released);
}

/**
 * The delivery in this namespace whose verified merge was never observed to completion.
 *
 * A route belongs to the delivery, not to whichever run happened to be alive when the provider
 * declined, so a project has to be able to ask the question. Only deliveries that already hold a
 * merge receipt qualify: adopting an unverified route would let a stranded delivery hijack a new
 * run's engineering.
 */
export function outstandingRoute(
  deliveries: DeliveryRecord[],
  projectId: string,
  environmentId: string,
): DeliveryRecord | undefined {
  return deliveries.find(
    (delivery) =>
      delivery.projectId === projectId &&
      delivery.environment.id === environmentId &&
      !!delivery.receipts.merge &&
      !routeComplete(delivery),
  );
}
