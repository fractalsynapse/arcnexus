import { createHash } from 'node:crypto';
import { stringify } from 'yaml';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Capture, RevisionCitation } from '../../architecture/src/index.js';
import type { Proposal } from './proposal.js';

export interface GoalPatch {
  path: string;
  before: string | null;
  content: string | null;
}

export interface HumanReply {
  question: string;
  answer: string;
}

/** Derive the objective filename from the exact submitted text. */
export function objectivePath(session: TaskSession) {
  return `${session.capture.project.knowledgeRoot ?? '.arc'}/objectives/${textDigest(session.goal)}.md`;
}

/** Fingerprint exact UTF-8 bytes for stable identities and checked edits. */
export function textDigest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

/** Render the exact old and proposed bytes without suppressing whitespace. */
export function showPatch(edits: readonly GoalPatch[]) {
  return edits
    .map(
      ({ path, before, content }) =>
        `--- ${path} (current)\n${JSON.stringify(before)}\n+++ ${path} (proposed)\n${JSON.stringify(content)}`,
    )
    .join('\n\n');
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
      ...proposal.ratings.map((rating) =>
        [
          `## ${rating.id} · alignment ${rating.alignment} · evidence ${rating.evidence}`,
          rating.reason,
          ...rating.sources.map((citation) => renderCitation('Source', citation, source)),
          ...rating.observations.map((citation) => renderCitation('Evidence', citation, source)),
        ].join('\n\n'),
      ),
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

/** Preserve provenance and human wording separately from the Planner's interpretation. */
export function objectiveRecord(
  session: TaskSession,
  proposal: Proposal,
  replies: readonly HumanReply[],
  goals: Set<string>,
) {
  const { source } = session.capture;
  const metadata = stringify({
    revision: source.revision,
    goals: proposal.links.map((id) => ({ id, status: goals.has(id) ? 'active' : 'proposed' })),
  }).trimEnd();
  return (
    [
      `---\n${metadata}\n---`,
      '# Human objective',
      '## Exact submission',
      fenced(session.goal),
      ...replies.flatMap(({ question, answer }) => [
        '## Clarification',
        fenced(question),
        '### Exact human answer',
        fenced(answer),
      ]),
      '## Planner interpretation',
      proposal.summary,
      ...proposal.sources.map((citation) => renderCitation('Source', citation, source)),
    ].join('\n\n') + '\n'
  );
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
