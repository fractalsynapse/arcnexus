import type { ActivityOutcome } from '../../workflow/src/index.js';
import type { StewardCheckFailure } from '../../direction/src/index.js';
import type { CheckedEdit } from './edits.js';

type CheckRequest = Pick<StewardCheckFailure, 'id' | 'expected'>;

export type StewardResult =
  | { kind: 'completed'; edits: CheckedEdit[]; checks: CheckRequest[] }
  | Exclude<ActivityOutcome, { kind: 'completed' }>;

/** Distinguish invalid proposals from failures after the host starts executing them. */
export class StewardResponseError extends Error {}

/** Decode one top-level outcome without executing any proposed edit or check. */
export function decodeSteward(
  reply: unknown,
  allowed: readonly string[],
  correction?: StewardCheckFailure,
): StewardResult {
  const value = object(reply, 'response');
  switch (value.kind) {
    case 'completed':
      return {
        kind: 'completed',
        edits: edits(value.edits),
        checks: checks(value.checks, allowed, correction),
      };
    case 'supplier':
      return supplier(value);
    case 'question':
      return { kind: 'question', question: required(value.question, 'question'), evidence: [] };
    case 'blocked':
      return { kind: 'blocked', reason: required(value.reason, 'reason'), evidence: [] };
    default:
      throw new StewardResponseError(
        'response.kind: expected a top-level completed, supplier, question, or blocked outcome',
      );
  }
}

/** Keep the provider-owned outcome shape free of model-supplied check failures and evidence. */
function supplier(value: Record<string, unknown>): StewardResult {
  return {
    kind: 'supplier',
    owner: required(value.owner, 'owner'),
    milestone: required(value.milestone, 'milestone'),
    reason: required(value.reason, 'reason'),
    evidence: [],
  };
}

/** Identify misplaced check records and validate checked-edit fields before the host writes. */
function edits(value: unknown): CheckedEdit[] {
  if (!Array.isArray(value))
    throw new StewardResponseError('response.edits: expected an array, even when empty');
  return value.map((entry, index) => {
    const at = `edits[${index}]`;
    const edit = object(entry, at);
    if ('id' in edit && !('path' in edit))
      throw new StewardResponseError(
        `response.${at}: operation requests belong in the top-level checks array`,
      );
    const path = required(edit.path, `${at}.path`);
    const { expected, content } = edit;
    if (expected !== null && (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)))
      throw new StewardResponseError(`response.${at}.expected: expected a SHA-256 or null`);
    if (content !== null && typeof content !== 'string')
      throw new StewardResponseError(`response.${at}.content: expected replacement text or null`);
    return { path, expected, content };
  });
}

/** Validate declared operations and keep an unresolved check first with its original expectation. */
function checks(
  value: unknown,
  allowed: readonly string[],
  correction?: StewardCheckFailure,
): CheckRequest[] {
  if (!Array.isArray(value))
    throw new StewardResponseError(
      'response.checks: expected a separate top-level array, even when empty',
    );
  const requested = value.map((entry, index) => checkRequest(entry, index, allowed));
  if (!correction) return requested;
  if (
    !allowed.includes(correction.id) ||
    requested.some(({ id, expected }) => id === correction.id && expected !== correction.expected)
  )
    throw new StewardResponseError(
      `Cannot change the required recheck for ${correction.id}: expected ${correction.expected}`,
    );
  return [correction, ...requested.filter(({ id }) => id !== correction.id)];
}

/** Resolve one requested operation from the captured activity. */
function checkRequest(value: unknown, index: number, allowed: readonly string[]): CheckRequest {
  const at = `checks[${index}]`;
  const check = object(value, at);
  const id = required(check.id, `${at}.id`);
  if (!allowed.includes(id))
    throw new StewardResponseError(
      `response.${at}.id: ${id} is unavailable; declared operations: ${allowed.join(', ') || 'none'}`,
    );
  const { expected } = check;
  if (expected !== 'pass' && expected !== 'fail')
    throw new StewardResponseError(`response.${at}.expected: expected pass or fail`);
  return { id, expected };
}

/** Reject non-object proposal fields with their exact location. */
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new StewardResponseError(`${field}: expected an object`);
  return value as Record<string, unknown>;
}

/** Require nonempty fields consumed inside the authority boundary. */
function required(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim())
    throw new StewardResponseError(`response.${field}: expected a nonempty string`);
  return value;
}
