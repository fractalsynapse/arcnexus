import { createElement as h } from 'react';
import type { ReactNode } from 'react';
import { AgentReport, Disclosure, WorkspaceLink } from '../../../../packages/ui/src/index.js';
import type { RevisionCitation } from '../../../../packages/architecture/src/index.js';
import type { Proposal, Rating } from '../../../../packages/planner/src/proposal.js';
import { guideLink } from './guide.js';

type Scope = { project: string; revision?: string };

/** Translate the retained Planner response into its named sections. */
export function PlannerReport({ report, project, revision }: Scope & { report: Proposal }) {
  const goal = (id: string) =>
    revision && report.ratings.some((rating) => rating.id === id)
      ? h(WorkspaceLink, { href: guideLink('goals', id, project, revision) }, id)
      : h('code', null, id);
  return h(AgentReport, {
    summary: report.summary,
    sections: [
      {
        title: 'Ratings',
        content: items(
          report.ratings.map((rating) => h(GoalRating, { rating, goal: goal(rating.id) })),
          'No goal ratings recorded.',
        ),
      },
      { title: 'Comparison', content: items(report.comparison, 'No comparison recorded.') },
      {
        title: 'Proposed changes',
        content: items(report.changes.map(proposedChange), 'No changes proposed.'),
      },
      { title: 'Goal links', content: items(report.links.map(goal), 'No goal links proposed.') },
      { title: 'Sources', content: h(Citations, { sources: report.sources }) },
    ],
  });
}

function GoalRating({ rating, goal }: { rating: Rating; goal: ReactNode }) {
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h('strong', null, goal),
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
      h(Disclosure, { label: 'Rating sources' }, h(Citations, { sources: rating.sources })),
    !!rating.observations.length &&
      h(
        Disclosure,
        { label: 'Rating observations' },
        h(Citations, { sources: rating.observations }),
      ),
  );
}

function runCitation(selection: NonNullable<Rating['run']>['selection']) {
  if ('criterion' in selection) return 'Criterion: ' + selection.criterion;
  if ('operation' in selection) return 'Check: ' + selection.operation;
  return 'Verified delivery';
}

function proposedChange({ id, content }: Proposal['changes'][number]) {
  return content === null
    ? h('span', null, 'Remove ', h('code', null, id))
    : h(Disclosure, { label: 'Proposed document ' + id }, h('pre', null, content));
}

function Citations({ sources }: { sources: readonly RevisionCitation[] }) {
  return items(
    sources.map(({ path, quote }) => h(Disclosure, { label: path }, h('blockquote', null, quote))),
    'No sources cited.',
  );
}

function items(entries: readonly ReactNode[], empty: string) {
  return entries.length
    ? h(
        'ul',
        null,
        entries.map((entry, index) => h('li', { key: index }, entry)),
      )
    : h('p', null, empty);
}
