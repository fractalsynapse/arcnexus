import { createElement as h, useState, type ChangeEvent } from 'react';
import type {
  ObjectiveDecision,
  ObjectiveDraft,
  ObjectiveReview,
} from '../../../planner/src/objective-review.js';
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
    { className: 'arc-answer-form' },
    h('p', null, review.summary),
    h('p', null, 'Captured revision ', h('code', null, review.revision)),
    review.readOnly && h('p', null, 'Selected drafts will be retained for onboarding.'),
    review.sourceChanges && h(ChangedSources, { sources: review.sourceChanges }),
    h(Tabs, {
      label: 'Objective drafts',
      sections: review.drafts.map((draft) => ({
        title: draft.id,
        content: h(DraftReview, { draft, ...draftState }),
      })),
    }),
    h(RevisionFeedback, draftState),
    h(ReviewActions, { review, input, pending, submit }),
    error && h('p', { role: 'alert' }, error),
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
    null,
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

function ReviewActions({ review, input, pending, submit }: ReviewActionProps) {
  const feedback = input.feedback.trim() ? input.feedback : undefined;
  const revised = !!feedback || Object.keys(input.edits).length > 0;
  return h(
    'div',
    { className: 'arc-command-actions' },
    h(
      Button,
      {
        disabled: pending || revised || !input.selected.length,
        onClick: () => submit({ action: 'approve', selected: input.selected }),
      },
      review.readOnly ? 'Retain selected drafts' : 'Approve selected',
    ),
    h(
      Button,
      {
        disabled: pending || !revised,
        onClick: () => submit({ action: 'revise', edits: input.edits, feedback }),
      },
      'Review revisions',
    ),
    h(Button, { disabled: pending, onClick: () => submit({ action: 'decline' }) }, 'Decline batch'),
  );
}

type DraftProps = DraftState & { draft: ObjectiveDraft };

function DraftReview(props: DraftProps) {
  const { title, path, gap, sources } = props.draft;
  return h(
    'section',
    { className: 'arc-answer-form' },
    h('strong', null, title),
    h('code', null, path),
    h('p', null, gap),
    h(SourceCitations, { sources }),
    h(DraftSelection, props),
    h(DraftWording, props),
  );
}

function DraftSelection({ draft, input, change, pending }: DraftProps) {
  return h(CheckboxField, {
    label: 'Select ' + draft.title,
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
        title: 'Changes',
        content: h(DiffView, {
          file: { path: draft.path, before: draft.before ?? '', after: content },
        }),
      },
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
    null,
    h('strong', null, 'Previously cited evidence changed'),
    h(SourceCitations, { sources }),
  );
}

function DraftEditor({ content, edit }: { content: string; edit(content: string): void }) {
  const { frontmatter, body } = splitMarkdown(content);
  return h(MarkdownEditor, { body, edit: (value) => edit(frontmatter + value) });
}
