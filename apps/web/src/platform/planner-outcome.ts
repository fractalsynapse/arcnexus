import { createElement as h, type ReactElement } from 'react';
import { ExternalLink, ObjectiveReviewSummary } from '../../../../packages/ui/src/index.js';
import { CommitLink, issueLink, pullLink } from './github-links.js';
import type { PlanOutcome } from './plan-resource.js';
import { RecommendedObjectives } from './recommended-objectives.js';
import type { RecommendationAssessment } from '../../../../packages/planner/src/objective-review.js';
import { PlannerReport } from './planner-report.js';

export interface OutcomeProps {
  value: PlanOutcome;
  remote?: string;
  project: string;
  revision?: string;
}

/** Present the recorded Plan disposition and its GitHub references. */
export function PlannerOutcome({ value, remote, project, revision }: OutcomeProps): ReactElement {
  const { active, outcome, changedPaths, report, recommendation } = value;
  if (!active && outcome?.kind === 'planned' && !report && recommendation?.selected.length)
    return h(RetainedRecommendations, { value: recommendation });
  const merged = outcome?.kind === 'merged';
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h('strong', null, active ? 'Active' : (outcome?.kind ?? 'Recorded')),
    h(OutcomeLinks, { value, remote }),
    outcome?.summary &&
      outcome.summary !== (report?.summary ?? recommendation?.summary) &&
      h('p', null, outcome.summary),
    outcome?.reason && h('p', null, outcome.reason),
    merged && h('p', null, 'Merged ', h(CommitLink, { remote, revision: outcome.commit })),
    !!changedPaths?.length &&
      h(
        'small',
        null,
        changedPaths.length + (changedPaths.length === 1 ? ' file changed' : ' files changed'),
      ),
    (report || recommendation) && h(PlannerReport, { report, recommendation, project, revision }),
  );
}

function RetainedRecommendations({ value }: { value: RecommendationAssessment }) {
  return h(
    'section',
    { className: 'arc-platform-stack' },
    h(
      'strong',
      { role: 'status' },
      value.selected.length === 1 ? 'Objective draft retained' : 'Objective drafts retained',
    ),
    h(RecommendedObjectives, { value }),
    h('small', null, 'Saved to this project’s onboarding history.'),
    h(ObjectiveReviewSummary, value),
  );
}

function LinkedRecord({
  href,
  label,
  state,
  closed,
}: {
  href: string;
  label: string;
  state?: string;
  closed?: boolean;
}) {
  const anchor = h(ExternalLink, { href }, label);
  return h(
    'span',
    { className: 'arc-github-record' },
    closed ? h('s', null, anchor) : anchor,
    state && h('small', null, state),
  );
}

function OutcomeLinks({ value, remote }: { value: PlanOutcome; remote?: string }) {
  const { outcome, issue, pull } = value;
  const issueUrl = issue && issueLink(remote, issue);
  const pullUrl = pull && pullLink(remote, pull.url);
  const merged = outcome?.kind === 'merged';
  return (
    (issueUrl || pullUrl) &&
    h(
      'div',
      { className: 'arc-platform-inline arc-github-outcome' },
      issueUrl && h(LinkedRecord, { href: issueUrl, label: 'Issue #' + issue }),
      pullUrl &&
        h(LinkedRecord, {
          href: pullUrl,
          label: 'PR #' + pullUrl.split('/').at(-1),
          state: merged ? 'Merged' : pull?.state,
          closed: merged || pull?.state === 'closed',
        }),
    )
  );
}
