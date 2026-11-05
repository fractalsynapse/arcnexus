import type { ProjectExecution } from '../architecture/execution-context.js';
import type { Operation } from '../operations/operations.js';

export interface CapturedPublicationPolicy {
  owner: string;
  operation: Extract<Operation, { action: 'delivery.publish' }>;
}

/** Resolves the accountable publisher from a single declared operation grant rather than a hardcoded component. */
export class PublicationPolicy {
  /** Requires unambiguous publication authority within the selected package and captured repository. */
  resolve(context: ProjectExecution): CapturedPublicationPolicy | undefined {
    const grants = context.owners.flatMap((owner) =>
      (context.catalog.components[owner]!.operationPlan?.agent ?? [])
        .filter(
          (operation): operation is CapturedPublicationPolicy['operation'] =>
            operation.kind === 'upstream' && operation.action === 'delivery.publish',
        )
        .map((operation) => ({ owner, operation })),
    );
    if (!grants.length) return undefined;
    if (grants.length !== 1)
      throw new Error(
        'Publication requires one accountable operation grant in the selected package',
      );
    const grant = grants[0]!;
    if (
      grant.operation.repository !== context.catalog.primaryRepository ||
      !grant.operation.definitionDigest
    )
      throw new Error('Publication grant does not match captured primary repository authority');
    return structuredClone(grant);
  }
}
