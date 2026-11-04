import type { Component } from '../architecture/components.js';
import type { ResolvedAssignment } from '../architecture/assignment.js';
import { currentComponentTests } from '../testing/captured-tests.js';
import type { RecordData } from '../workspace/state.js';
import { OperationArguments } from './operation-definition.js';
import type { Operation } from './operations.js';

/** Refreshes derived suite selection without replacing the run's captured owner, profile or definition. */
export function currentOperationContext<T extends Operation>(record: RecordData, operation: T): T {
  const tokens = operation.definitionArguments ?? [];
  if (!tokens.some((token) => typeof token !== 'string' && token.context === 'selectedTestFiles'))
    return operation;
  const owner = testOwner(record, operation);
  const context = operation.resolvedContext;
  if (
    !owner ||
    !context ||
    context.ownerId !== owner.id ||
    !context.testOutputRoot ||
    !owner.testProfile
  )
    throw new Error('Current test selection requires captured owner and profile context');
  const selectedTests = currentComponentTests(owner, record.workspace, context.testOutputRoot);
  return {
    ...new OperationArguments().capture(
      operation,
      {
        ...context,
        selectedTestFiles: selectedTests.map((test) => test.compiled),
      },
      !!operation.profileVerification,
    ),
    selectedTests,
  } as T;
}

/** Resolves test ownership from the captured assignment or assembled delivery catalog. */
function testOwner(record: RecordData, operation: Operation): Component | undefined {
  const resolved = record.resolvedAssignment as ResolvedAssignment | undefined;
  return (
    resolved?.context.at(-1) ??
    (record.operationCatalog as Component[] | undefined)?.find(
      (component) => component.id === operation.resolvedContext?.ownerId,
    )
  );
}
