import type { Goal, Milestone, ReleaseCheck, ReleaseCheckpoint, RunRevision } from './model.ts';
import {
  escape,
  githubOutcome,
  noData,
  panel,
  readouts,
  shortCommitReference,
  status,
} from './view.ts';

const stagingStatus = {
  Passed: 'Verified on staging',
  Failed: 'Merged · checks failed',
  Running: 'Merged · verifying',
  Unavailable: 'Merged · checks unavailable',
  Unrecorded: 'Merged · checks unrecorded',
};

export function releaseEvidence(goal: Goal, revision: RunRevision) {
  const commit = revision.kind === 'merged' ? goal.delivery.commit : undefined;
  const review = goal.review.findLast(
    (item) => item.seq <= revision.seq && item.run === revision.run,
  );
  const hostedFailures = goal.hostedFailures.filter((item) => item.seq <= revision.seq);
  const lastFailure = hostedFailures.at(-1);
  const gates = revision.release;
  const observation = gates?.postMerge;
  const checks = commit && observation?.commit === commit ? observation.checks : [];
  const postMerge = checkState(checks);
  const pr = commit ? goal.delivery.pr : lastFailure?.pr;
  const currentFailure = !commit && lastFailure && lastFailure.seq >= (review?.seq ?? revision.seq);

  const prState = gates
    ? checkState([...gates.prChecks, gates.externalReview])
    : currentFailure
      ? 'Failed'
      : 'Unrecorded';
  let summary = 'Awaiting independent review';
  if (revision.kind === 'satisfied') summary = 'No staging change';
  else if (commit) summary = stagingStatus[postMerge];
  else if (review?.kind === 'rejected') summary = 'Changes requested';
  else if (prState === 'Failed') summary = 'PR checks failed';
  else if (gates?.externalReview.state === 'pending') summary = 'Awaiting external review';
  else if (review?.kind === 'accepted') summary = 'Awaiting staging merge';

  return { commit, review, hostedFailures, gates, checks, postMerge, pr, prState, summary };
}

function checkState(checks: ReleaseCheck[]) {
  if (!checks.length) return 'Unrecorded';
  if (checks.some((check) => check.state === 'failed')) return 'Failed';
  if (checks.some((check) => check.state === 'unavailable')) return 'Unavailable';
  if (checks.some((check) => check.state === 'pending')) return 'Running';
  return 'Passed';
}

export function releaseChecks(checks: ReleaseCheck[]) {
  return checks
    .map(
      (check) => `<div class="arc-finding">
    <div class="arc-row"><strong>${escape(check.name)}</strong>${status(
      {
        passed: 'Passed',
        pending: 'Pending',
        failed: 'Failed',
        unavailable: 'Unavailable',
      }[check.state],
    )}</div><p>${escape(check.detail)}</p></div>`,
    )
    .join('');
}

export function releaseCheckpoint(goal: Goal, revision: RunRevision, milestone: Milestone) {
  return goal.checkpoints?.findLast(
    (item) => item.seq <= revision.seq && item.milestone === milestone.id,
  );
}

export function checkpointPanel(goal: Goal, revision: RunRevision, milestone: Milestone) {
  const checkpoint = releaseCheckpoint(goal, revision, milestone);
  const issue = goal.delivery.issue;
  const issueLink = issue
    ? githubOutcome('Issue', issue, goal.delivery.issueState, goal.delivery.issueComments)
    : '';
  return panel(
    'Release checkpoint',
    (checkpoint ? checkpointEvidence(checkpoint) : retainedEdit(goal, revision, milestone)) +
      issueLink,
    checkpoint ? status('Checkpoint published') : '',
  );
}

function retainedEdit(goal: Goal, revision: RunRevision, milestone: Milestone) {
  const latestEdit = goal.receipts.findLast(
    (item) =>
      item.seq <= revision.seq &&
      item.owner === milestone.owner &&
      item.milestone === milestone.id &&
      item.head,
  );
  const receipt = latestEdit?.head
    ? readouts(
        [['Latest checked edit', shortCommitReference(latestEdit.head)]],
        'arc-release-revisions',
      )
    : '';
  return (
    receipt +
    noData(
      'Staging-base checks, branch publication and the issue comment were not recorded as a milestone checkpoint.',
    )
  );
}

function checkpointEvidence(checkpoint: ReleaseCheckpoint) {
  return (
    readouts(
      [
        ['Tested staging revision', shortCommitReference(checkpoint.base)],
        ['Checkpoint commit', shortCommitReference(checkpoint.commit)],
        ['Shared issue branch', `<code>${escape(checkpoint.branch)}</code>`],
      ],
      'arc-release-revisions',
    ) +
    '<details><summary>Integration checks</summary>' +
    releaseChecks(checkpoint.checks) +
    '</details>' +
    `<details><summary>Issue comment</summary><p>${escape(checkpoint.issueComment)}</p></details>`
  );
}
