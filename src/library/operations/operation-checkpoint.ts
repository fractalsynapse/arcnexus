import type { Component } from '../architecture/components.js';
import type { ResolvedAssignment } from '../architecture/assignment.js';
import type { RecordData } from '../workspace/state.js';
import { currentOperationContext } from './current-context.js';
import { OperationArguments, OperationOrder } from './operation-definition.js';
import type { Operation } from './operations.js';

export interface OperationStep {
  operation: Operation;
  purpose: string;
}

/** Resolves the host-captured owner without accepting an operation's claimed authority. */
export function operationOwner(record: RecordData, operation: Operation): Component {
  const assignment = record.resolvedAssignment as ResolvedAssignment | undefined;
  const catalog = record.operationCatalog as Component[] | undefined;
  const owner =
    assignment?.context.at(-1) ??
    catalog?.find((component) => component.id === operation.resolvedContext?.ownerId);
  if (
    !owner ||
    owner.id !== operation.resolvedContext?.ownerId ||
    owner.repository !== operation.repository
  )
    throw new Error('Operation requires captured owner authority');
  return owner;
}

/** Canonicalizes effective read scope for operation deduplication and preparation reuse. */
export function operationReads(record: RecordData, operation: Operation): string[] {
  const paths = [...new Set(operationOwner(record, operation).access.readPaths)].sort();
  return paths.filter(
    (path) =>
      !paths.some((parent) => parent !== path && (parent === '.' || path.startsWith(`${parent}/`))),
  );
}

/** Plans finite prerequisites and deduplicates equivalent execution within one explicit checkpoint. */
export class OperationCheckpoint {
  readonly notApplicable: Array<{
    operationId: string;
    ownerId: string;
    profile: string;
    purpose: string;
  }> = [];

  /** Retains captured authority while resolving current candidate test selection. */
  constructor(private readonly record: RecordData) {}

  /** Validates the complete dependency graph before any command in the checkpoint is dispatched. */
  resolve(steps: OperationStep[]): OperationStep[] {
    this.notApplicable.length = 0;
    const seen = new Set<string>();
    return steps
      .filter((step) => this.applicable(step))
      .flatMap(({ operation, purpose }) =>
        this.dependencies(operation).map((dependency) => ({ operation: dependency, purpose })),
      )
      .filter((step) => {
        this.validate(step.operation);
        const key = this.identity(step.operation);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  /** Records empty implicit profile selections without weakening explicitly declared verification. */
  private applicable(step: OperationStep): boolean {
    if (!step.operation.profileVerification) return true;
    const operation = currentOperationContext(this.record, step.operation);
    if (!operation.pendingContext?.includes('selectedTestFiles')) return true;
    const owner = operationOwner(this.record, operation);
    if (
      owner.testProfile !== operation.profileVerification ||
      !owner.operationPlan?.verify?.some(
        (entry) =>
          entry.id === operation.id && entry.profileVerification === operation.profileVerification,
      )
    )
      throw new Error('Profile verification requires captured test-profile authority');
    this.notApplicable.push({
      operationId: operation.id,
      ownerId: owner.id,
      profile: operation.profileVerification!,
      purpose: step.purpose,
    });
    return false;
  }

  /** Resolves finite preparation for an explicit service start without executing the service as a checkpoint. */
  prerequisites(operation: Operation): Operation[] {
    return this.dependencies(operation).filter((entry) => entry.id !== operation.id);
  }

  /** Requires service authority in the owner's captured agent operation plan. */
  service(operation: Operation): Operation {
    const owner = operationOwner(this.record, operation);
    const captured = owner.operationPlan?.agent?.find((entry) => entry.id === operation.id);
    if (
      operation.kind !== 'service' ||
      captured?.kind !== 'service' ||
      captured.definitionDigest !== operation.definitionDigest ||
      operation.schemaVersion !== 4
    )
      throw new Error('Missing captured agent service authority');
    return new OperationArguments().capture(captured, operation.resolvedContext!);
  }

  /** Captures the managed service dependency named by a finite HTTP operation. */
  serviceFor(operation: Operation): Operation {
    if (operation.kind !== 'http') throw new Error('HTTP service reference required');
    const owner = operationOwner(this.record, operation);
    const service = owner.operationPlan?.agent?.find(
      (entry) => entry.id === operation.http.serviceId,
    );
    if (!service) throw new Error(`Missing captured agent service: ${operation.http.serviceId}`);
    return this.service(new OperationArguments().capture(service, operation.resolvedContext!));
  }

  /** Expands prerequisites only from the captured owner's declared operation plan. */
  private dependencies(operation: Operation): Operation[] {
    const owner = operationOwner(this.record, operation);
    const available = Object.values(owner.operationPlan ?? {}).flat();
    const registry = Object.fromEntries(available.map((entry) => [entry.id, entry]));
    const captured = registry[operation.id];
    if (captured && captured.definitionDigest !== operation.definitionDigest)
      throw new Error(`Operation definition changed: ${operation.id}`);
    registry[operation.id] = operation;
    if (operation.kind === 'http') this.serviceFor(operation);
    return new OperationOrder(registry)
      .resolve([operation.id])
      .map((entry) => this.capture(entry, operation));
  }

  /** Refreshes assignment selection before requiring all invocation inputs to be executable. */
  private capture(entry: Operation, requested: Operation): Operation {
    const refreshed = currentOperationContext(this.record, {
      ...entry,
      resolvedContext: requested.resolvedContext,
    });
    return new OperationArguments().capture(refreshed, refreshed.resolvedContext!);
  }

  /** Refuses unresolved, unbounded or legacy operations before partial lifecycle execution. */
  private validate(operation: Operation): void {
    if (
      ['service', 'upstream'].includes(operation.kind) ||
      operation.schemaVersion !== 4 ||
      operation.argumentTokens ||
      operation.pendingContext?.length ||
      !operation.definitionDigest ||
      !operation.resolvedContext
    )
      throw new Error('A finite captured operation with resolved host context is required');
  }

  /** Includes effective read permissions while ignoring unused owner context in otherwise identical commands. */
  private identity(operation: Operation): string {
    const reads = operationReads(this.record, operation);
    const { resolvedContext: _context, ...definition } = operation;
    return JSON.stringify({ definition, reads });
  }
}
