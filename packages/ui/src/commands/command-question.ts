import {
  objectiveReviewLabel,
  type ObjectiveReview,
} from '../../../planner/src/objective-review.js';
import { ObjectiveReviewForm } from './objective-review-form.js';
import { createElement as h, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { Button } from '../controls/button.js';
import { useCommandAction } from './use-command-action.js';
import { Dialog } from '../controls/dialog.js';

interface Props {
  question: string;
  send(answer: string): Promise<void>;
  identity?: string;
  label?: string;
  review?: ObjectiveReview;
}

const drafts = new Map<string, string>();

/** Keep a draft with this gate even while its dialog is closed. */
export function CommandQuestion({ question, send, identity, label, review }: Props) {
  const [open, setOpen] = useState(false);
  const title = review ? objectiveReviewLabel : 'Answer question';
  const form = useAnswerForm({ question, send, identity }, setOpen);
  return h(
    'div',
    { className: 'arc-command-question' },
    h(QuestionTrigger, { label: review ? title : (label ?? title), open: () => setOpen(true) }),
    h(
      Dialog,
      { title, open, onClose: () => setOpen(false) },
      review
        ? h(ObjectiveReviewForm, {
            review,
            identity,
            send: async (answer) => {
              await send(answer);
              setOpen(false);
            },
          })
        : h(AnswerForm, form),
    ),
  );
}

interface AnswerProps {
  question: string;
  answer: string;
  setAnswer(value: string): void;
  busy: boolean;
  submit(event: SubmitEvent): void;
  error: string;
}

function AnswerForm({ question, answer, setAnswer, busy, submit, error }: AnswerProps) {
  return h(
    'form',
    { className: 'arc-answer-form', onSubmit: submit },
    h('p', null, question),
    h(
      'label',
      null,
      'Answer',
      h('textarea', {
        value: answer,
        required: true,
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setAnswer(event.currentTarget.value),
      }),
    ),
    h(Button, { type: 'submit', disabled: busy || !answer.trim() }, 'Send answer'),
    error && h('p', { role: 'alert' }, error),
  );
}

function QuestionTrigger({ label, open }: { label: string; open: () => void }) {
  return h(Button, { 'aria-haspopup': 'dialog', onClick: open }, label);
}

function useAnswerForm({ question, send, identity }: Props, setOpen: (open: boolean) => void) {
  const [answer, setAnswer] = useState(() => (identity ? (drafts.get(identity) ?? '') : ''));
  const { pending: busy, error, perform } = useCommandAction();
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (busy || !answer.trim()) return;
    void perform(async () => {
      await send(answer);
      if (identity) drafts.delete(identity);
      setOpen(false);
    }, 'The answer could not be submitted.');
  };
  return {
    question,
    answer,
    busy,
    submit,
    error,
    setAnswer: (value: string) => {
      if (identity) drafts.set(identity, value);
      setAnswer(value);
    },
  };
}
