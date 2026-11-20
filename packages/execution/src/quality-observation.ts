import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { Quality, qualityScopePrefix, type QualityScope } from '../../foundation/src/index.js';
import { team } from '../../team/src/index.js';
import type { Capture } from '../../architecture/src/index.js';
import type { CheckResult } from './check.js';

const qualityApplicability = {
  'owner-format-files': 'format:check',
  'owner-lint-files': 'lint',
} as const;

/** Validate confined scope evidence without loading candidate executable configuration in the host. */
export function qualityObservation(
  capture: Capture,
  worktree: string,
  owner: string | undefined,
  result: CheckResult,
  stdout: string,
): CheckResult {
  const applicability = capture.operations[result.id]?.applicability;
  if (!applicability || !(applicability in qualityApplicability) || result.status !== 0)
    return result;
  try {
    const operation = qualityApplicability[applicability as keyof typeof qualityApplicability];
    const selection = readSelection(stdout, owner, operation);
    validateScope(capture, worktree, selection);
    const reason = !selection.files.length
      ? `No applicable ${operation} files for ${owner}`
      : undefined;
    return { ...result, selection, ...(reason ? { status: 'not-applicable', reason } : {}) };
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    appendFileSync(result.log, `\nError: ${diagnostic}\n`);
    return { ...result, diagnostic };
  }
}

/** Authorize observed files through the current Team rather than raw component-document equality. */
function validateScope(capture: Capture, worktree: string, selection: QualityScope) {
  const members = team.list(capture.components);
  const files = new Quality(worktree).validateOwnership(members);
  for (const path of selection.files) {
    const resolved = team.ownerFor(members, path);
    assert(
      files.has(path) && resolved.kind === 'owned' && resolved.owner.id === selection.owner,
      `Quality selection exceeds captured scope: ${path}`,
    );
  }
}

/** Require one unambiguous record from the declared command; a successful exit alone does not prove scope. */
function readSelection(stdout: string, owner: string | undefined, operation: string): QualityScope {
  const records = stdout.split('\n').filter((line) => line.startsWith(qualityScopePrefix));
  assert(records.length === 1, 'Missing or ambiguous quality selection evidence');
  const scope = JSON.parse(records[0]!.slice(qualityScopePrefix.length));
  assert(
    scope && scope.operation === operation && scope.owner === owner,
    'Quality selection binding mismatch',
  );
  assert(
    Array.isArray(scope.files) && scope.files.every((path: unknown) => typeof path === 'string'),
    'Invalid quality selection files',
  );
  return scope;
}
