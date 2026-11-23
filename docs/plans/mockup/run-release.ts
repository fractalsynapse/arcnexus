import { diffView, readPatch } from './diff.ts';
import type { Goal } from './model.ts';
import { ogsmGoal } from './ogsm-example.ts';
import { exampleLabel } from './ogsm.ts';
import { splitPanels } from './panels.ts';
import { releaseChecks, releaseEvidence } from './release-evidence.ts';
import { currentGoal, currentSnapshot, revisionControl } from './run-context.ts';
import {
  breadcrumbs,
  button,
  escape,
  githubOutcome,
  githubReferences,
  noData,
  outcomeName,
  panel,
  pill,
  readouts,
  shortCommitReference,
  status,
  title,
} from './view.ts';

type Evidence = ReturnType<typeof releaseEvidence>;

export function releaseCard() {
  const goal = currentGoal();
  const evidence = releaseEvidence(goal, currentSnapshot());
  return `<div>${status(evidence.summary)}</div>${references(goal, evidence)}`;
}

export function releasePage() {
  const goal = currentGoal();
  const evidence = releaseEvidence(goal, currentSnapshot());
  return (
    breadcrumbs([['Run', '/run/'], ['Release']]) +
    title('Release', goal.title, goal === ogsmGoal ? exampleLabel() : '') +
    `<div class="arc-detail-toolbar">${revisionControl()}</div>` +
    splitPanels(
      {
        id: 'arc-delivery-outcome',
        label: 'Release evidence',
        content: (action) =>
          `<div class="arc-stack">${panel(
            'Release evidence',
            references(goal, evidence) + evidenceStages(goal, evidence),
            `<div class="arc-row">${status(evidence.summary)}${action}</div>`,
          )}${releaseAction(evidence)}${hostedCheckHistory(evidence)}</div>`,
      },
      {
        id: 'arc-delivery-changes',
        label: 'Changes',
        content: (action) => deliveryDiff(goal.delivery, evidence.commit, action),
      },
    )
  );
}

function hostedCheckHistory(evidence: Evidence) {
  const { hostedFailures } = evidence;
  return hostedFailures.length
    ? panel(
        'Hosted check history',
        hostedFailures.map((item) => `<p>${githubReferences(item.diagnostic)}</p>`).join(''),
      )
    : '';
}

function references(goal: Goal, evidence: Evidence) {
  const d = goal.delivery;
  if (goal === ogsmGoal)
    return readouts([
      ['Issue', 'Example issue'],
      ['Staging PR', 'Example staging PR'],
    ]);
  const issue = d.issue
    ? githubOutcome('Issue', d.issue, d.issueState, d.issueComments)
    : noData('No issue linked to this assessment.');
  const number = evidence.pr?.split('/').at(-1);
  const pr = number
    ? githubOutcome(
        'PR',
        number,
        evidence.commit ? 'merged' : undefined,
        evidence.commit ? d.prCommits : undefined,
      )
    : noData('No PR observed for this revision.');
  return `<div class="arc-issue"><small>GitHub issue</small>${issue}</div>
    <div class="arc-issue"><small>Staging PR</small>${pr}</div>`;
}

function evidenceStages(goal: Goal, evidence: Evidence) {
  const { review, gates, commit, prState, checks, postMerge } = evidence;
  const reviewDetail = review
    ? `<p>Reviewed tree <code>${escape(review.candidate)}</code> · ${review.criteria.length} criteria</p>
      ${button('Open independent review', '/run/review/', 'arrow-up-right')}`
    : noData('No independent verdict recorded at this revision.');
  const gateDetail = gates
    ? releaseChecks([...gates.prChecks, gates.externalReview])
    : noData('Individual PR check and external review results are unavailable in this capture.');
  const postDetail = checks.length
    ? releaseChecks(checks)
    : noData(
        commit
          ? 'No post-merge checks recorded for this staging commit.'
          : 'Post-merge checks require a staging commit.',
      );
  return `<ol class="arc-release-stages">
    ${evidenceRow('Independent review', review ? outcomeName(review.kind) : 'Not recorded', reviewDetail)}
    ${evidenceRow('PR checks and external review', prState, gateDetail)}
    ${evidenceRow('Staging merge', commit ? 'Merged' : 'Not recorded', mergeEvidence(goal.delivery.publication, commit))}
    ${evidenceRow('Post-merge checks', postMerge, postDetail)}</ol>`;
}

function mergeEvidence(publication: Goal['delivery']['publication'], commit?: string) {
  if (!commit) return noData('No staging merge recorded at this revision.');
  return readouts(
    [
      ['Staging commit', shortCommitReference(commit)],
      ['PR head', shortCommitReference(publication?.head)],
      ['Staging parent', shortCommitReference(publication?.parent)],
    ],
    'arc-release-revisions',
  );
}

function evidenceRow(label: string, state: string, body: string) {
  return `<li><details><summary><span class="arc-release-label">${escape(label)}</span>${status(state)}</summary>
    <div class="arc-release-stage-body">${body}</div></details></li>`;
}

function releaseAction(evidence: Evidence) {
  const next = `<p>Direction receives the candidate identity and failure evidence, then assigns the correction. The corrected candidate returns through the required review and checks.</p>
    <div>${button('Open Direction', '/run/direction/', 'arrow-up-right')}</div>`;
  const failed = evidence.postMerge === 'Failed' || evidence.prState === 'Failed';
  const rejectedAfterFailure =
    evidence.hostedFailures.length > 0 && evidence.review?.kind === 'rejected';
  const content =
    failed || rejectedAfterFailure
      ? `<h3>Route to Direction</h3>${next}`
      : `<details><summary>If final release needs an engineering correction</summary><p><strong>Route to Direction</strong></p>${next}</details>`;
  return panel('Action on release', content, pill('Routing preview', 'quiet'));
}

function deliveryDiff(delivery: Goal['delivery'], commit: string | undefined, action: string) {
  if (!commit || !delivery.files.length)
    return panel('Changes', noData('No confirmed PR diff at this revision.'), action);
  const patches = new Map(
    readPatch(delivery.patch ?? '', delivery.patchPath).map((file) => [file.path, file]),
  );
  return diffView(
    'Staging merge',
    delivery.files.map(([, path]) => {
      const file = patches.get(path);
      return {
        path,
        lines: file?.lines ?? [],
        note: !file
          ? 'Open the local merge patch to inspect this path.'
          : delivery.patchExcerpt
            ? 'Retained patch excerpt'
            : undefined,
      };
    }),
    { localPatch: true, action },
  );
}
