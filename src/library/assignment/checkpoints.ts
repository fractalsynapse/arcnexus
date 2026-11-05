import { SpecificationValidationError } from './specification-error.js';
import { existsSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { digest } from '../architecture/assignment.js';
import { classifyComponentPath, covered, type Component } from '../architecture/components.js';
import { changes, checkScope } from '../change-inspection/changes.js';
import type { AgentResult } from '../steward/codex.js';
import type { RecordData } from '../workspace/state.js';

export interface FrozenTest {
  path: string;
  content: string;
  sha256: string;
}

/** Requires actual scope-checked specification changes before capturing immutable regression sources. */
export function specificationFiles(
  record: RecordData,
  component: Component,
  documentationOnly: boolean,
  selected = changes(record),
): FrozenTest[] {
  const observed = selected;
  const { documentation, testPaths } = specificationPaths(component, observed);
  checkScope(record.workspace, observed, component.allowedWritePaths);
  if (!observed.some((c) => covered(c.path, documentation)))
    throw new SpecificationValidationError(
      'Make an actual owned documentation edit describing the intended behavior before implementation.',
      'missing-documentation',
      'Specification must document changed intent',
    );
  if (documentationOnly) return [];
  const tests = observed.filter((c) => covered(c.path, testPaths));
  if (!tests.length)
    throw new SpecificationValidationError(
      'Add or update an owned regression test before implementation.',
      'missing-regression-source',
      'Specification must add or update regression tests',
    );
  return tests.map((change) => freezeRegression(record, change));
}

/** Captures one existing regression source after ownership and specification classification checks. */
function freezeRegression(
  record: RecordData,
  change: ReturnType<typeof changes>[number],
): FrozenTest {
  if (change.kind === 'D') throw new Error('Regression checkpoint cannot delete tests');
  const content = readFileSync(join(record.workspace, change.path));
  return { path: change.path, content: content.toString('base64'), sha256: digest(content) };
}

/** Applies the captured classifier to proposed files without inventing documentation or test evidence. */
function specificationPaths(component: Component, observed: ReturnType<typeof changes>) {
  if (component.schemaVersion !== 6)
    throw new Error('Specification capture requires version-six authority');
  const documentation = observed
    .filter((c) => classifyComponentPath(component, c.path) === 'documentation')
    .map((c) => c.path);
  const testPaths = observed
    .filter((c) => classifyComponentPath(component, c.path) === 'tests')
    .map((c) => c.path);
  return { documentation, testPaths };
}

/** Compares candidate bytes with the accepted checkpoint, never with the earlier Git baseline. */
export function frozenReview(record: RecordData, tests: FrozenTest[]) {
  checkFrozenPaths(record.workspace, tests);
  return {
    basis: 'frozen-regression-checkpoint',
    files: tests.map((test) => {
      if (digest(Buffer.from(test.content, 'base64')) !== test.sha256)
        throw new Error('Frozen regression digest mismatch');
      const currentSha256 = frozenCurrentHash(join(record.workspace, test.path));
      return {
        path: test.path,
        frozenSha256: test.sha256,
        currentSha256,
        status:
          currentSha256 === null
            ? 'missing'
            : currentSha256 === test.sha256
              ? 'preserved'
              : 'changed',
      };
    }),
  };
}

/** Rejects shared or non-regular candidate files instead of attributing foreign bytes to a checkpoint. */
function frozenCurrentHash(path: string): string | null {
  if (!existsSync(path)) return null;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('Unsafe frozen regression path');
  return digest(readFileSync(path));
}

export async function withFrozenTests(
  record: RecordData,
  tests: FrozenTest[],
  check: () => Promise<void>,
): Promise<void> {
  checkFrozenPaths(record.workspace, tests);
  const saved = tests.map((t) => {
    const path = join(record.workspace, t.path);
    return { path, content: existsSync(path) ? readFileSync(path) : null };
  });
  try {
    installFrozenTests(record.workspace, tests);
    await check();
    for (const test of tests)
      if (digest(readFileSync(join(record.workspace, test.path))) !== test.sha256)
        throw new Error('Verification altered frozen regression');
  } finally {
    checkFrozenPaths(record.workspace, tests);
    for (const file of saved) {
      if (file.content === null) {
        if (existsSync(file.path)) unlinkSync(file.path);
      } else writeFileSync(file.path, file.content);
    }
  }
}

export { candidateDigest } from '../change-inspection/changes.js';

export function validateRequests(
  result: AgentResult,
  componentId: string,
  owners: string[],
  allowUnknownOwner = false,
  generalYield = false,
): void {
  for (const request of result.requests) {
    if (request.fromComponent !== componentId)
      throw new Error('Boundary request has wrong requesting component');
    if (!allowUnknownOwner && request.ownerId !== null && !owners.includes(request.ownerId))
      throw new Error(
        `Unknown boundary owner: ${request.ownerId}; use null for an architectural question`,
      );
  }
  if (!generalYield && result.requests.length && result.status !== 'blocked')
    throw new Error('Unresolved boundary requests must report blocked');
  if (
    result.status === 'blocked' &&
    !result.blockers.length &&
    !(generalYield && result.requests.length)
  )
    throw new Error('Blocked result requires a reason');
}

function installFrozenTests(workspace: string, tests: FrozenTest[]): void {
  for (const test of tests) {
    const bytes = Buffer.from(test.content, 'base64');
    if (digest(bytes) !== test.sha256) throw new Error('Frozen regression digest mismatch');
    const path = join(workspace, test.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
}

function checkFrozenPaths(workspace: string, tests: FrozenTest[]): void {
  checkScope(
    workspace,
    tests.map((t) => ({ path: t.path, kind: 'M' })),
    tests.map((t) => t.path),
  );
}
