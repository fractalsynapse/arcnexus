import {
  revisionCitation,
  type Capture,
  type RevisionCitation,
} from '../../architecture/src/index.js';
import { citesVerifiedRun, type VerifiedGoalRun } from '../../execution/src/index.js';
import { readGoal, recordID } from './inventory.js';

const alignments = ['strong', 'partial', 'unmapped'] as const;
const evidenceLevels = ['demonstrated', 'partial', 'unverified'] as const;

export interface Rating {
  id: string;
  alignment: (typeof alignments)[number];
  evidence: (typeof evidenceLevels)[number];
  reason: string;
  sources: RevisionCitation[];
  observations: RevisionCitation[];
  run?: VerifiedGoalRun;
}

export interface GoalChange {
  id: string;
  content: string | null;
}

export interface Proposal {
  summary: string;
  ratings: Rating[];
  comparison: string[];
  changes: GoalChange[];
  links: string[];
  sources: RevisionCitation[];
}

/** Check the complete model proposal against the inventory captured for this task. */
export function decodeProposal(
  reply: unknown,
  capture: Capture,
  ids: readonly string[],
  objective: boolean,
  run?: VerifiedGoalRun,
): Proposal {
  const value = mapping(reply);
  const ratings = list(value.ratings, 'ratings').map((entry) => rating(entry, capture, run));
  checkRatings(ratings, ids, objective);
  const changes = goalChanges(value.changes, ids);
  const available = new Set([...ids, ...changes.map(({ id }) => id)]);
  const links = list(value.links, 'links').map((entry) => word(entry, 'goal link'));
  if (new Set(links).size !== links.length || links.some((id) => !available.has(id)))
    throw new Error('Objective links must name distinct existing or proposed goals');
  const comparison = list(value.comparison, 'comparison').map((entry) => word(entry, 'comparison'));
  if (!comparison.length) throw new Error('Compare goal gaps, overlap and conflicts explicitly');
  const sources = citations(value.sources, capture, 'sources');
  if (objective && !sources.length)
    throw new Error('An objective needs at least one source citation for its proposed mapping');
  return {
    summary: word(value.summary, 'summary'),
    ratings,
    comparison,
    changes,
    links,
    sources,
  };
}

/** Require exploration to cover the full inventory and forbid foreign or duplicate IDs. */
function checkRatings(ratings: readonly Rating[], ids: readonly string[], objective: boolean) {
  const rated = ratings.map(({ id }) => id);
  if (!objective && (rated.length !== ids.length || ids.some((id) => !rated.includes(id))))
    throw new Error('Exploration must rate each captured goal exactly once');
  if (new Set(rated).size !== rated.length || rated.some((id) => !ids.includes(id)))
    throw new Error('Ratings must use unique captured goal IDs');
}

/** Require traceable reasons for a rating and keep project alignment distinct from evidence. */
function rating(entry: unknown, capture: Capture, run?: VerifiedGoalRun): Rating {
  const value = mapping(entry);
  const alignment = alignments.find((option) => option === value.alignment);
  const evidence = evidenceLevels.find((option) => option === value.evidence);
  if (!alignment || !evidence) throw new Error('Invalid goal alignment or evidence rating');
  const sources = citations(value.sources, capture, 'sources');
  const observations = citations(value.observations, capture, 'observations');
  if (alignment !== 'unmapped' && !sources.length)
    throw new Error('A mapped goal needs a captured source citation');
  const citedRun = citesVerifiedRun(value.run, run, capture.source.revision) ? run : undefined;
  if (value.run && !citedRun) throw new Error('Unknown or stale verified run citation');
  if (evidence === 'demonstrated' && !citedRun)
    throw new Error('Demonstrated evidence requires an applicable verified run');
  if (evidence !== 'unverified' && !observations.length && !citedRun)
    throw new Error('An evidence rating needs a captured observation');
  return {
    id: word(value.id, 'rating ID'),
    alignment,
    evidence,
    reason: word(value.reason, 'rating reason'),
    sources,
    observations,
    run: citedRun,
  };
}

/** Admit only complete, owner-free goal documents or removals of existing IDs. */
function goalChanges(input: unknown, ids: readonly string[]) {
  const seen = new Set<string>();
  return list(input, 'changes', 10).map((entry): GoalChange => {
    const { id, content } = mapping(entry);
    if (typeof id !== 'string' || !recordID.test(id) || seen.has(id))
      throw new Error('Goal changes must use unique Markdown record IDs');
    seen.add(id);
    if (content === null && ids.includes(id)) return { id, content };
    if (typeof content !== 'string' || content.length > 12_000)
      throw new Error(`Goal ${id} needs a complete Markdown document or valid removal`);
    const { body } = readGoal(id, content);
    if (!/(?:\*\*Success measures\.\*\*|^#{1,6} Success measures)\s+\S/im.test(body))
      throw new Error(`Goal ${id} needs an explicit Success measures section`);
    return { id, content };
  });
}

/** Bind supplied citations to the captured revision before publishing a report. */
function citations(value: unknown, capture: Capture, name: string) {
  return list(value, name, 20).map((entry) => revisionCitation(entry, capture.source));
}

/** Read a model object while rejecting arrays and scalars. */
function mapping(entry: unknown): Record<string, unknown> {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry))
    throw new Error('Planner response must contain structured objects');
  return entry as Record<string, unknown>;
}

/** Bound collections before constructing prompts, evidence or candidate files. */
function list(value: unknown, name: string, limit = 500): unknown[] {
  if (!Array.isArray(value) || value.length > limit)
    throw new Error(`Invalid Planner ${name} list`);
  return value;
}

/** Require meaningful prose without rewriting the model's supplied text. */
function word(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 8_000)
    throw new Error(`Invalid Planner ${name}`);
  return value;
}
