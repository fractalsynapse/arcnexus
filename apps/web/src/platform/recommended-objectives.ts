import { createElement as h } from 'react';
import { DialogButton, DiffView, SourceCitations } from '../../../../packages/ui/src/index.js';
import type {
  ObjectiveDraft,
  RecommendationAssessment,
} from '../../../../packages/planner/src/objective-review.js';

/** Keep selected wording and source evidence accessible after Plan finishes. */
export function RecommendedObjectives({ value }: { value: RecommendationAssessment }) {
  return h(
    'section',
    { className: 'arc-platform-stack' },
    h('p', null, value.summary),
    value.selected.length > 0 &&
      h(
        'ul',
        { className: 'arc-report-list' },
        value.selected.map((draft) =>
          h('li', { key: draft.id }, h(RetainedObjective, { draft, revision: value.revision })),
        ),
      ),
  );
}

function RetainedObjective({ draft, revision }: { draft: ObjectiveDraft; revision: string }) {
  const { title, gap, sources, path, before, content } = draft;
  return h(DialogButton, {
    label: title,
    title,
    children: h(
      'section',
      { className: 'arc-platform-stack' },
      h('p', null, gap),
      h(SourceCitations, { sources: sources.map((source) => ({ ...source, revision })) }),
      h(DiffView, { file: { path, before: before ?? '', after: content } }),
    ),
  });
}
