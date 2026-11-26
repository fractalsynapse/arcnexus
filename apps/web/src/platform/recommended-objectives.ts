import { createElement as h } from 'react';
import {
  DialogButton,
  MarkdownView,
  ObjectiveDraftDetails,
  ObjectiveReviewSummary,
} from '../../../../packages/ui/src/index.js';
import type {
  ObjectiveDraft,
  RecommendationAssessment,
} from '../../../../packages/planner/src/objective-review.js';

/** Keep selected wording and source evidence accessible after Plan finishes. */
export function RecommendedObjectives({
  value,
  showSummary,
}: {
  value: RecommendationAssessment;
  showSummary?: boolean;
}) {
  return h(
    'section',
    { className: 'arc-platform-stack' },
    showSummary && h(ObjectiveReviewSummary, value),
    value.selected.length > 0 &&
      h(
        'ul',
        { className: 'arc-report-list' },
        value.selected.map((draft) => h('li', { key: draft.id }, h(ObjectiveDocument, { draft }))),
      ),
  );
}

function ObjectiveDocument({ draft }: { draft: ObjectiveDraft }) {
  return h(DialogButton, {
    label: draft.title,
    title: 'Objective draft',
    children: h(
      'section',
      { className: 'arc-objective-review' },
      h(
        'section',
        { 'aria-label': 'Objective wording' },
        h(MarkdownView, { content: draft.content }),
      ),
      h(ObjectiveDraftDetails, { draft }),
    ),
  });
}
