import { createElement as h } from 'react';
import type { ObjectiveDraft } from '../../../planner/src/objective-review.js';
import { Disclosure } from '../controls/disclosure.js';
import { SourceCitations } from './source-citations.js';

/** Show the model's rationale and provenance alongside reviewed wording. */
export function ObjectiveDraftDetails({ draft }: { draft: ObjectiveDraft }) {
  return h(
    Disclosure,
    { label: 'Supporting information' },
    h(
      'div',
      { className: 'arc-review-context' },
      h('section', null, h('h3', null, 'Why this objective'), h('p', null, draft.gap)),
      h(
        'section',
        null,
        h('h3', null, 'Source excerpts'),
        h(SourceCitations, { sources: draft.sources }),
      ),
      h(
        'dl',
        null,
        h('dt', null, 'Category'),
        h('dd', null, draft.category),
        h('dt', null, 'Draft file'),
        h('dd', null, h('code', null, draft.path)),
      ),
    ),
  );
}

/** Keep the batch assessment and capture available below its objective drafts. */
export function ObjectiveReviewSummary({
  summary,
  revision,
}: {
  summary: string;
  revision: string;
}) {
  return h(
    Disclosure,
    { label: 'Planning summary' },
    h(
      'div',
      { className: 'arc-review-context' },
      h('p', null, summary),
      h('dl', null, h('dt', null, 'Captured revision'), h('dd', null, h('code', null, revision))),
    ),
  );
}
