import { posix } from 'node:path';
import type { Assignment } from './assignment.js';
import type { Component } from './components.js';
import { covered, scopePath } from './component-paths.js';
import { classifyComponentPath } from './file-classification.js';
import { InputError } from './config.js';
import { assertBehavioralTestScope } from '../testing/captured-tests.js';

/** Resolves narrowed write authority and rejects workflows whose mandatory specification cannot fit. */
export function assignmentScope(assignment: Assignment, component: Component): string[] {
  const requested = assignment.allowedWritePaths ?? component.allowedWritePaths;
  for (const path of requested) {
    scopePath(path);
    if (!covered(path, component.allowedWritePaths))
      throw new InputError(`Assignment widens component scope: ${path}`);
  }
  const writable = assignment.kind === 'change' ? requested : [];
  if (
    component.schemaVersion === 6 &&
    assignment.kind === 'change' &&
    (!assignment.changeType || assignment.changeType === 'behavior')
  ) {
    assertBehavioralTestScope(component, writable);
    if (!writable.some((path) => allowsDocumentation(component, path)))
      throw new InputError(
        `Behavioral assignment for ${component.id} requires owned documentation scope for its specification; request corrected scope, or use the refactor workflow for test-only characterization without changing behavior. Active assignment authority cannot be widened.`,
      );
  }
  return writable;
}

/** Applies the captured classifier to existing files and possible new documentation inside owned directories. */
function allowsDocumentation(component: Component, path: string): boolean {
  if (classifyComponentPath(component, path) === 'documentation') return true;
  const inventory = component.inventory ?? [];
  if (inventory.some((file) => file.path === path)) return false;
  const directory = inventory.some((file) => covered(file.path, [path]));
  if (!directory && posix.extname(path)) return false;
  const declared = inventory.some(
    (file) =>
      covered(file.path, [path]) && classifyComponentPath(component, file.path) === 'documentation',
  );
  return (
    declared ||
    classifyComponentPath(component, posix.join(path, 'specification.md')) === 'documentation'
  );
}
