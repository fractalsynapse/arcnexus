import { createElement as h } from 'react';
import type { ReactNode } from 'react';
import {
  AgentReport,
  DialogButton,
  SourceCitations,
  WorkspaceLink,
} from '../../../../packages/ui/src/index.js';
import type { RecommendationAssessment } from '../../../../packages/planner/src/objective-review.js';
import { RecommendedObjectives } from './recommended-objectives.js';
import type { GoalChange, Proposal, Rating } from '../../../../packages/planner/src/proposal.js';
import { guideLink } from './guide.js';

type Scope = { project: string; revision?: string; delivered?: string };

/** Translate the retained Planner response into its named sections. */
export function PlannerReport({
  report,
  recommendation,
  ...scope
}: Scope & {
  report?: Proposal;
  recommendation?: RecommendationAssessment;
}) {
  return h(AgentReport, {
    label: 'Planner report',
    summary: report?.summary ?? recommendation?.summary ?? '',
    sections: [
      ...(recommendation ? [objectivesSection(recommendation, report)] : []),
      ...(report ? reportSections(report, scope) : []),
    ],
  });
}

function objectivesSection(recommendation: RecommendationAssessment, report?: Proposal) {
  return {
    title: 'Objectives',
    count: recommendation.selected.length,
    content: h(RecommendedObjectives, {
      value: recommendation,
      showSummary: !!report && report.summary !== recommendation.summary,
    }),
  };
}

function reportSections(report: Proposal, scope: Scope) {
  const changes = new Map(report.changes.map((change) => [change.id, change]));
  const rated = new Set(report.ratings.map(({ id }) => id));
  const { project, revision } = scope;
  return [
    listSection(
      'Ratings',
      report.ratings.map((rating) =>
        h(GoalRating, { rating, goal: goalFile(rating.id, project, revision) }),
      ),
      'No goal ratings recorded.',
    ),
    listSection('Comparison', report.comparison, 'No comparison recorded.', 'ol'),
    listSection('Changes', report.changes.map(proposedChange), 'No changes proposed.'),
    listSection(
      'Goal links',
      report.links.map((id) => goalReference(id, scope, changes.get(id), rated.has(id))),
      'No goal links proposed.',
    ),
    {
      title: 'Sources',
      count: report.sources.length,
      content: h(SourceCitations, { sources: report.sources }),
    },
  ];
}

/** Open the published goal, its captured preimage, or the retained proposal before delivery. */
function goalReference(
  id: string,
  { project, revision, delivered }: Scope,
  change?: GoalChange,
  rated?: boolean,
) {
  if (!delivered && !rated && change?.content != null) return goalProposal(id, change.content, id);
  return goalFile(id, project, change?.content === null ? revision : (delivered ?? revision));
}

function goalFile(id: string, project: string, revision?: string) {
  return revision
    ? h(WorkspaceLink, { href: guideLink('goals', id, project, revision) }, id)
    : h('code', null, id);
}

function listSection(title: string, entries: readonly ReactNode[], empty: string, element?: 'ol') {
  return { title, count: entries.length, content: items(entries, empty, element) };
}

function GoalRating({ rating, goal }: { rating: Rating; goal: ReactNode }) {
  return h(
    'div',
    { className: 'arc-report-item-heading' },
    h(
      'div',
      { className: 'arc-report-rating' },
      h('strong', null, goal),
      h(
        'div',
        { className: 'arc-report-tags' },
        h('small', null, 'Alignment: ' + rating.alignment),
        h('small', null, 'Evidence: ' + rating.evidence),
      ),
    ),
    h(DialogButton, {
      label: 'Details',
      title: 'Rating for ' + rating.id,
      children: h(RatingDetails, { rating }),
    }),
  );
}

function RatingDetails({ rating }: { rating: Rating }) {
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h('small', null, 'Alignment: ' + rating.alignment + ' · Evidence: ' + rating.evidence),
    h('p', null, rating.reason),
    rating.run &&
      h(
        'p',
        null,
        'Verified run for ',
        h('code', null, rating.run.goalID),
        ' · ',
        runCitation(rating.run.selection),
      ),
    !!rating.sources.length &&
      h('section', null, h('h3', null, 'Sources'), h(SourceCitations, { sources: rating.sources })),
    !!rating.observations.length &&
      h(
        'section',
        null,
        h('h3', null, 'Observations'),
        h(SourceCitations, { sources: rating.observations }),
      ),
  );
}

function runCitation(selection: NonNullable<Rating['run']>['selection']) {
  if ('criterion' in selection) return 'Criterion: ' + selection.criterion;
  if ('operation' in selection) return 'Check: ' + selection.operation;
  return 'Verified delivery';
}

function proposedChange({ id, content }: Proposal['changes'][number]) {
  return h(
    'div',
    { className: 'arc-report-item-heading' },
    h('strong', null, id),
    content === null ? h('small', null, 'Remove goal') : goalProposal(id, content, 'View proposal'),
  );
}

function goalProposal(id: string, content: string, label: string) {
  return h(DialogButton, {
    label,
    title: 'Proposed document ' + id,
    children: h('pre', { className: 'arc-report-text' }, content),
  });
}

function items(entries: readonly ReactNode[], empty: string, element: 'ol' | 'ul' = 'ul') {
  return entries.length
    ? h(
        element,
        { className: 'arc-report-list' },
        entries.map((entry, index) => h('li', { key: index }, entry)),
      )
    : h('p', null, empty);
}
