import { createElement as h, useState, type ChangeEvent } from 'react';
import type {
  ObjectiveDecision,
  ObjectiveDraft,
  ObjectiveReview,
} from '../../../planner/src/objective-review.js';
import { MarkdownView } from '../content/markdown-view.js';
import { Disclosure } from '../controls/disclosure.js';
import { MarkdownEditor } from '../content/markdown-editor.js';
import { splitMarkdown } from '../../../foundation/src/markdown-document.js';
import { SourceCitations } from '../content/source-citations.js';
import { DiffView } from '../content/diff-view.js';
import { Button } from '../controls/button.js';
import { CheckboxField } from '../controls/checkbox-field.js';
import { Tabs } from '../controls/tabs.js';
import { useCommandAction } from './use-command-action.js';

interface ReviewProps {
  review: ObjectiveReview;
  identity?: string;
  send(answer: string): Promise<void>;
}

interface DraftInput {
  selected: string[];
  edits: Record<string, string>;
  feedback: string;
}

const retained = new Map<string, DraftInput>();

export function ObjectiveReviewForm({ review, identity = review.id, send }: ReviewProps) {
  const { input, change, submit, pending, error } = useDraftReview({ review, identity, send });
  const draftState = { input, change, pending };
  return h(
    'div',
    { className: 'arc-objective-review' },
    review.sourceChanges && h(ChangedSources, { sources: review.sourceChanges }),
    h(ReviewDrafts, { review, ...draftState }),
    h(ReviewContext, { review }),
    h(RevisionFeedback, draftState),
    review.readOnly && h('small', null, 'Retained drafts are available after project admission.'),
    review.drafts.length > 1 && h(DraftSelections, { review, ...draftState }),
    h(ReviewActions, { review, input, pending, submit }),
    error && h('p', { role: 'alert' }, error),
  );
}

function ReviewDrafts({ review, ...state }: DraftState & { review: ObjectiveReview }) {
  const drafts = review.drafts;
  if (drafts.length === 1) return h(DraftReview, { draft: drafts[0]!, ...state });
  return h(Tabs, {
    label: 'Objective drafts',
    sections: drafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      content: h(DraftReview, { draft, ...state }),
    })),
  });
}

function ReviewContext({ review }: Pick<ReviewProps, 'review'>) {
  return h(
    Disclosure,
    { label: 'Planning summary' },
    h(
      'div',
      { className: 'arc-review-context' },
      h('p', null, review.summary),
      h(
        'dl',
        null,
        h('dt', null, 'Captured revision'),
        h('dd', null, h('code', null, review.revision)),
      ),
    ),
  );
}

function useDraftReview({ review, identity = review.id, send }: ReviewProps) {
  const [input, setInput] = useState(
    () =>
      retained.get(identity) ?? {
        selected: review.drafts.map(({ id }) => id),
        edits: {},
        feedback: '',
      },
  );
  const { pending, error, perform } = useCommandAction();
  const change = (patch: Partial<DraftInput>) => {
    const next = { ...input, ...patch };
    retained.set(identity, next);
    setInput(next);
  };
  const submit = (decision: ObjectiveDecision) =>
    void perform(async () => {
      await send(JSON.stringify(decision));
      retained.delete(identity);
    }, 'The review could not be submitted.');
  return { input, change, submit, pending, error };
}

type DraftState = { input: DraftInput; change(patch: Partial<DraftInput>): void; pending: boolean };

function RevisionFeedback({ input, change, pending }: DraftState) {
  return h(
    'label',
    { className: 'arc-review-feedback' },
    'Feedback for a revised proposal',
    h('textarea', {
      value: input.feedback,
      disabled: pending,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
        change({ feedback: event.currentTarget.value }),
    }),
  );
}

type ReviewActionProps = Pick<DraftState, 'input' | 'pending'> & {
  review: ObjectiveReview;
  submit(decision: ObjectiveDecision): void;
};

function DraftSelections({ review, ...state }: DraftState & { review: ObjectiveReview }) {
  const { drafts, readOnly } = review;
  return h(
    'fieldset',
    { className: 'arc-review-selections' },
    h('legend', null, readOnly ? 'Drafts to retain' : 'Drafts to approve'),
    h('small', null, `${state.input.selected.length} of ${drafts.length} selected`),
    h(
      'div',
      { className: 'arc-review-selection-list' },
      drafts.map((draft) => h(DraftSelection, { key: draft.id, draft, ...state })),
    ),
  );
}

function ReviewActions({ review, input, pending, submit }: ReviewActionProps) {
  const feedback = input.feedback.trim() ? input.feedback : undefined;
  const revised = !!feedback || Object.keys(input.edits).length > 0;
  const singleDraft = review.drafts.length === 1;
  return h(
    'div',
    { className: 'arc-command-actions' },
    h(
      Button,
      {
        disabled: pending || revised || !input.selected.length,
        onClick: () => submit({ action: 'approve', selected: input.selected }),
      },
      approvalLabel(review.readOnly, singleDraft),
    ),
    h(
      Button,
      {
        disabled: pending || !revised,
        onClick: () => submit({ action: 'revise', edits: input.edits, feedback }),
      },
      'Review revisions',
    ),
    h(
      Button,
      { disabled: pending, onClick: () => submit({ action: 'decline' }) },
      singleDraft ? 'Decline draft' : 'Decline batch',
    ),
  );
}

function approvalLabel(readOnly: boolean, single: boolean) {
  if (readOnly) return single ? 'Retain draft' : 'Retain selected drafts';
  return single ? 'Approve draft' : 'Approve selected';
}

type DraftProps = DraftState & { draft: ObjectiveDraft };

function DraftReview(props: DraftProps) {
  return h(
    'section',
    { className: 'arc-review-draft' },
    h(DraftWording, props),
    h(DraftContext, { draft: props.draft }),
  );
}

function DraftContext({ draft }: { draft: ObjectiveDraft }) {
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

function DraftSelection({ draft, input, change, pending }: DraftProps) {
  return h(CheckboxField, {
    label: draft.title,
    checked: input.selected.includes(draft.id),
    disabled: pending,
    onChange: (checked) =>
      change({
        selected: checked
          ? [...input.selected, draft.id]
          : input.selected.filter((id) => id !== draft.id),
      }),
  });
}

function DraftWording({ draft, input, change }: DraftProps) {
  const content = input.edits[draft.id] ?? draft.content;
  return h(Tabs, {
    label: 'Objective wording',
    sections: [
      {
        title: 'Proposed objective',
        content: h('section', { 'aria-label': 'Proposed objective' }, h(MarkdownView, { content })),
      },
      ...(draft.before === null
        ? []
        : [
            {
              title: 'Changes',
              content: h(DiffView, {
                file: { path: draft.path, before: draft.before, after: content },
              }),
            },
          ]),
      {
        title: 'Edit wording',
        content: h(DraftEditor, {
          content,
          edit: (text) => change({ edits: changedDraft(input.edits, draft, text) }),
        }),
      },
    ],
  });
}

function changedDraft(previous: Record<string, string>, draft: ObjectiveDraft, content: string) {
  const edits = { ...previous };
  if (content === draft.content) delete edits[draft.id];
  else edits[draft.id] = content;
  return edits;
}

function ChangedSources({ sources }: { sources: NonNullable<ObjectiveReview['sourceChanges']> }) {
  return h(
    'section',
    { className: 'arc-review-source-change' },
    h('h3', null, 'Previously cited evidence changed'),
    h(SourceCitations, { sources }),
  );
}

function DraftEditor({ content, edit }: { content: string; edit(content: string): void }) {
  const { frontmatter, body } = splitMarkdown(content);
  return h(MarkdownEditor, { body, edit: (value) => edit(frontmatter + value) });
}
