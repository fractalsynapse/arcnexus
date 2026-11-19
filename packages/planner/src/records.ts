import { parse, stringify } from 'yaml';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Capture, RevisionCitation } from '../../architecture/src/index.js';
import { unifiedDiff, textDigest, type ContentPatch } from '../../foundation/src/index.js';
import type { Proposal } from './proposal.js';

export type GoalPatch = ContentPatch;
export { textDigest };

export interface HumanReply {
  question: string;
  answer: string;
}

/** Derive the objective filename from the exact submitted text. */
export function objectivePath(session: TaskSession) {
  return `${objectiveDirectory(session)}/${textDigest(session.goal)}.md`;
}

/** Resolve objective storage from the captured project knowledge root. */
export function objectiveDirectory(session: TaskSession) {
  return `${session.capture.project.knowledgeRoot ?? '.arc'}/objectives`;
}

/** Honor an explicit refinement reference and retain the original objective's stable identity. */
export function refinement(session: TaskSession) {
  const previous = /^Refines ([a-f0-9]{64})\s*$/im.exec(session.goal)?.[1];
  if (!previous) return;
  const path = `${objectiveDirectory(session)}/${previous}.md`;
  const { source } = session.capture;
  if (!source.paths.includes(path)) throw new Error(`Unknown objective to refine: ${previous}`);
  const metadata = parse(source.read(path).split('---', 3)[1] ?? '') as {
    objective?: string;
  } | null;
  return { objective: metadata?.objective ?? previous, supersedes: previous };
}

/** Render the exact old and proposed bytes without suppressing whitespace. */
export function showPatch(edits: readonly GoalPatch[]) {
  return edits.map(unifiedDiff).join('\n\n');
}

/** Format every rated goal with durable source and evidence references. */
export function reportProposal(
  proposal: Proposal,
  source: Capture['source'],
  edits: readonly GoalPatch[],
) {
  return (
    [
      '# Goal mapping',
      `Captured revision: \`${source.revision}\``,
      proposal.summary,
      ...proposal.ratings.map((rating) => renderRating(rating, source)),
      '## Coverage, overlap and conflicts',
      ...proposal.comparison.map((entry) => `- ${entry}`),
      ...(proposal.links.length ? [`Goal links: ${proposal.links.join(', ')}`] : []),
      ...proposal.sources.map((citation) => renderCitation('Source', citation, source)),
      edits.length
        ? `## Proposed inventory changes\n\n${showPatch(edits)}`
        : 'No inventory change proposed.',
    ].join('\n\n') + '\n'
  );
}

/** Render a goal's source citations and the independently observed evidence identity. */
function renderRating(rating: Proposal['ratings'][number], source: Capture['source']) {
  return [
    `## ${rating.id} · alignment ${rating.alignment} · evidence ${rating.evidence}`,
    rating.reason,
    ...rating.sources.map((citation) => renderCitation('Source', citation, source)),
    ...(rating.run
      ? [
          `- Verified run · ${rating.run.pull ? `[${rating.run.id}](${rating.run.pull})` : rating.run.id} at \`${rating.run.revision}\``,
        ]
      : []),
    ...rating.observations.map((citation) => renderCitation('Evidence', citation, source)),
  ].join('\n\n');
}

/** Preserve provenance and human wording separately from the Planner's interpretation. */
export function objectiveRecord(
  session: TaskSession,
  proposal: Proposal,
  replies: readonly HumanReply[],
  goals: Set<string>,
) {
  const { source } = session.capture;
  const metadata = stringify({
    ...refinement(session),
    mapping: proposal.links.length ? 'mapped' : 'unresolved',
    revision: source.revision,
    goals: proposal.links.map((id) => ({ id, status: goals.has(id) ? 'active' : 'proposed' })),
  }).trimEnd();
  return (
    [
      `---\n${metadata}\n---`,
      '# Human objective',
      '## Exact submission',
      fenced(session.goal),
      ...replies.flatMap(renderReply),
      '## Planner interpretation',
      proposal.summary,
      ...proposal.sources.map((citation) => renderCitation('Source', citation, source)),
    ].join('\n\n') + '\n'
  );
}

/** Keep the question and exact human answer together in the objective history. */
function renderReply({ question, answer }: HumanReply) {
  return ['## Clarification', fenced(question), '### Exact human answer', fenced(answer)];
}

/** Delimit exact user text even when it contains Markdown fences. */
function fenced(value: string) {
  const length = Math.max(2, ...Array.from(value.matchAll(/`+/g), ([match]) => match.length));
  const fence = '`'.repeat(length + 1);
  return `${fence}text\n${value}\n${fence}`;
}

/** Link the issuing revision's repository-relative path through the report context. */
function renderCitation(
  label: string,
  { path, quote }: RevisionCitation,
  source: Capture['source'],
) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const link = `${source.remote?.replace(/\.git$/, '')}/blob/${source.revision}/${encoded}`;
  return `- ${label} · [${path}](${link})\n\n${fenced(quote)}`;
}
