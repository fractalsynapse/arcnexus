import type { ActivityOutcome } from '../../workflow/src/index.js';
import type { StewardCheckFailure } from '../../direction/src/index.js';
import type { ProposedEdit } from './formatter.js';

type CheckRequest = Pick<StewardCheckFailure, 'id' | 'expected'>;

export type StewardResult =
  | {
      kind: 'completed';
      edits: ProposedEdit[];
      checks: CheckRequest[];
      archiveResearch?: string[];
      answer?: string;
    }
  | Exclude<ActivityOutcome, { kind: 'completed' }>;

/** Distinguish invalid proposals from failures after the host starts executing them. */
export class StewardResponseError extends Error {}

/** Decode one top-level outcome without executing any proposed edit or check. */
export function decodeSteward(
  reply: unknown,
  allowed: readonly string[],
  correction?: StewardCheckFailure,
  hostChecks: readonly string[] = [],
): StewardResult {
  const value = object(reply, 'response');
  switch (value.kind) {
    case 'completed':
      return completedReply(value, allowed, correction, hostChecks);
    case 'supplier':
      return supplier(value);
    case 'question':
      return { kind: 'question', question: required(value.question, 'question'), evidence: [] };
    case 'blocked':
      return { kind: 'blocked', reason: required(value.reason, 'reason'), evidence: [] };
    case 'repair':
      return localRepair(value);
    default:
      throw new StewardResponseError(
        'response.kind: expected a top-level completed, repair, supplier, question, or blocked outcome',
      );
  }
}

/** Decode a completed proposal's authorized effects and optional complete supplier answer. */
function completedReply(
  value: Record<string, unknown>,
  allowed: readonly string[],
  correction: StewardCheckFailure | undefined,
  hostChecks: readonly string[],
): StewardResult {
  return {
    kind: 'completed',
    edits: edits(value.edits),
    checks: checks(value.checks, allowed, correction, hostChecks),
    ...archiveSelection(value.archiveResearch),
    ...(typeof value.answer === 'string' && value.answer.trim() ? { answer: value.answer } : {}),
  };
}

/** Accept a steward finding without letting it supply progress evidence or new authority. */
function localRepair(value: Record<string, unknown>): StewardResult {
  const activity = value.activity;
  if (activity !== 'documentation' && activity !== 'testing' && activity !== 'implementation')
    throw new StewardResponseError(
      'response.activity: expected documentation, testing or implementation',
    );
  return { kind: 'repair', activity, reason: required(value.reason, 'reason'), evidence: [] };
}

/** Accept only distinct report identities for copying checked evidence into the archive. */
function archiveSelection(value: unknown) {
  if (value === undefined) return {};
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))
  )
    throw new StewardResponseError(
      'response.archiveResearch: expected an array of research report IDs',
    );
  return { archiveResearch: [...new Set(value as string[])] };
}

/** Keep the provider-owned outcome shape free of model-supplied check failures and evidence. */
function supplier(value: Record<string, unknown>): StewardResult {
  return {
    kind: 'supplier',
    owner: required(value.owner, 'owner'),
    milestone: required(value.milestone, 'milestone'),
    reason: required(value.reason, 'reason'),
    ...(typeof value.question === 'string' && value.question.trim()
      ? { question: value.question }
      : {}),
    evidence: [],
  };
}

/** Identify misplaced check records and validate checked-edit fields before the host writes. */
function edits(value: unknown): ProposedEdit[] {
  if (!Array.isArray(value))
    throw new StewardResponseError('response.edits: expected an array, even when empty');
  const paths = new Set<string>();
  return value.map((entry, index) => {
    const at = `edits[${index}]`;
    const edit = decodeEdit(entry, at);
    if (paths.has(edit.path))
      throw new StewardResponseError(`response.${at}.path: duplicate edit for ${edit.path}`);
    paths.add(edit.path);
    return edit;
  });
}

/** Decode one source mutation for either a tool call or a steward result fixture. */
export function decodeEdit(entry: unknown, at = 'checked edit'): ProposedEdit {
  const edit = object(entry, at);
  if ('id' in edit && !('path' in edit))
    throw new StewardResponseError(
      `response.${at}: operation requests belong in the top-level checks array`,
    );
  const path = required(edit.path, `${at}.path`);
  const { expected, content } = edit;
  if (expected !== null && (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)))
    throw new StewardResponseError(`response.${at}.expected: expected a SHA-256 or null`);
  if ('transform' in edit) {
    if ('content' in edit || expected === null)
      throw new StewardResponseError(
        `response.${at}: a transform requires an existing file hash and no content field`,
      );
    return { path, expected, transform: transform(edit.transform, at) };
  }
  if (content !== null && typeof content !== 'string')
    throw new StewardResponseError(`response.${at}.content: expected replacement text or null`);
  return { path, expected, content };
}

/** Require a formatter or a nonempty exact text substitution. */
function transform(value: unknown, path: string) {
  const field = `${path}.transform`;
  const operation = object(value, field);
  const replace =
    operation.replace === undefined ? undefined : object(operation.replace, `${field}.replace`);
  const format = operation.format === true;
  if (!format && !replace)
    throw new StewardResponseError(`response.${field}: expected format true or a replacement`);
  if (!replace) return { format };
  const before = required(replace.before, `${field}.replace.before`);
  if (typeof replace.after !== 'string')
    throw new StewardResponseError(
      `response.${field}.replace.after: expected a string, possibly empty`,
    );
  return { format, replace: { before, after: replace.after } };
}

/** Validate declared operations and keep an unresolved check first with its original expectation. */
function checks(
  value: unknown,
  allowed: readonly string[],
  correction: StewardCheckFailure | undefined,
  hostChecks: readonly string[],
): CheckRequest[] {
  if (!Array.isArray(value))
    throw new StewardResponseError(
      'response.checks: expected a separate top-level array, even when empty',
    );
  const requested = value
    .map((entry, index) => checkRequest(entry, index, allowed, hostChecks))
    .filter((operation) => operation !== undefined);
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

/** Permit declared operations and discard passing declarations for scheduled host checks. */
function checkRequest(
  value: unknown,
  index: number,
  allowed: readonly string[],
  hostChecks: readonly string[],
): CheckRequest | undefined {
  const at = `checks[${index}]`;
  const check = object(value, at);
  const id = required(check.id, `${at}.id`);
  const { expected } = check;
  if (!allowed.includes(id) && hostChecks.includes(id) && expected === 'pass') return;
  if (!allowed.includes(id))
    throw new StewardResponseError(
      `response.${at}.id: ${id} is unavailable; declared operations: ${allowed.join(', ') || 'none'}`,
    );
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
