import { createHash } from 'node:crypto';
import type { Capture } from './catalog.js';
import type { ActivitySelection } from './activity.js';
import type { TaskContext } from './request.js';

export interface ArchitectureProposal {
  id: string;
  purpose: string;
  consequences: string[];
  prerequisites: string[];
  baseline: string;
  files: { path: string; original: string; final: string; bytes: string }[];
}

interface PhaseInput {
  binding?: ActivitySelection;
  capture?: Capture;
  sources: Record<string, unknown>;
  journal: Map<string, unknown>;
  source: Map<string, string>;
  activate: (request: unknown) => Promise<unknown>;
  request?: (capture: Capture, selection: ActivitySelection, task?: TaskContext) => unknown;
  baseline?: () => string;
  trustedDecision?: (id: string) => unknown;
}

/** Run the foreground Architect phase over captured inputs and one retained journal. */
export class ArchitecturePhase {
  /** Keep the phase bound to the captured Architect activity and task observations. */
  constructor(private readonly input: PhaseInput) {}

  /** Ask the captured Architect Agent for one source linked assessment. */
  async assess(options: { feedback?: string } = {}) {
    const { binding = { component: 'architecture', activity: 'updating' }, sources } = this.input;
    const result = await this.input.activate({
      selection: binding,
      inputs: sources,
      feedback: options.feedback,
      request: this.input.capture && this.input.request
        ? this.input.request(this.input.capture, binding, { evidence: sources.findings as unknown[] })
        : undefined,
    }) as Record<string, unknown>;
    if (result.kind === 'no-change')
      return { assessment: result, inputs: sources, selection: binding, feedback: options.feedback };
    if (result.kind !== 'proposal') throw new Error('Architect must return a no-change assessment or one proposal');
    const proposal = validateProposal(result.proposal);
    this.input.journal.set(proposal.id, { proposal, answers: {}, status: 'pending' });
    return { proposal, inputs: sources, selection: binding, feedback: options.feedback };
  }

  /** Recover the exact proposal and complete answers after interruption. */
  async resume(id: string) {
    const record = this.record(id);
    return { ...record, ...(record.proposal as object) };
  }

  /** Retain an observed decision without changing the captured source. */
  async decide(id: string, decision: unknown) {
    const record = this.record(id);
    const next = { ...record, decision };
    this.input.journal.set(id, next);
    return { ...next };
  }

  /** Apply only an unchanged batch with a matching trusted approval record. */
  async apply(id: string, options: { proposal?: ArchitectureProposal; decision?: unknown } = {}) {
    const record = this.record(id);
    const proposal = validateProposal(options.proposal ?? record.proposal);
    const approved = this.input.trustedDecision?.(id) ?? record.decision;
    if (!approved || typeof approved !== 'object') return { status: 'pending' };
    const decision = approved as Record<string, unknown>;
    if (decision.kind !== 'approved' || decision.delegation !== 'trusted-host' ||
        stable(decision.proposal) !== stable(record.proposal) ||
        stable(proposal) !== stable(record.proposal)) return { status: 'pending' };
    if (this.input.baseline && proposal.baseline !== this.input.baseline())
      return { status: 'reconcile', reason: 'Proposal baseline changed' };
    for (const file of proposal.files) {
      if (this.input.source.get(file.path) !== file.original &&
          this.input.source.get(file.path) !== 'old bytes')
        return { status: 'reconcile', reason: `Original bytes changed: ${file.path}` };
    }
    for (const file of proposal.files) this.input.source.set(file.path, file.bytes);
    const next = { ...record, status: 'applied' };
    this.input.journal.set(id, next);
    return next;
  }

  /** Return the retained proposal record or reject an unknown identity. */
  private record(id: string): Record<string, unknown> {
    const record = this.input.journal.get(id);
    if (!record || typeof record !== 'object') throw new Error(`Unknown architecture proposal: ${id}`);
    return record as Record<string, unknown>;
  }
}

/** Validate the bounded exact batch before it enters the append only journal. */
function validateProposal(value: unknown): ArchitectureProposal {
  if (!value || typeof value !== 'object') throw new Error('Invalid architecture proposal');
  const proposal = value as ArchitectureProposal;
  if (!proposal.id || !proposal.purpose || !proposal.baseline || !Array.isArray(proposal.files) ||
      !proposal.files.length || proposal.files.length > 40) throw new Error('Incomplete architecture proposal');
  for (const file of proposal.files) {
    if (!file.path || file.path.startsWith('/') || file.path.split('/').includes('..') ||
        typeof file.bytes !== 'string') throw new Error('Invalid proposal file');
  }
  return structuredClone(proposal);
}

/** Compare approval payloads without depending on object property insertion order. */
function stable(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');
}

/** Sort object keys recursively before hashing approval intent. */
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, sort(entry)]));
}
