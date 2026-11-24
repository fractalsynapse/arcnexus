import { createElement as h, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { Button } from '../controls/button.js';
import { useCommandAction } from './use-command-action.js';
import { Dialog } from '../controls/dialog.js';

interface Props {
  question: string;
  send(answer: string): Promise<void>;
}

/** Keep a draft with this gate even while its dialog is closed. */
export function CommandQuestion({ question, send }: Props) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const { pending: busy, error, perform } = useCommandAction();
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (busy || !answer.trim()) return;
    void perform(async () => {
      await send(answer);
      setOpen(false);
    }, 'The answer could not be submitted.');
  };
  return h(
    'div',
    { className: 'arc-command-question' },
    h(Button, { 'aria-haspopup': 'dialog', onClick: () => setOpen(true) }, 'Answer question'),
    h(
      Dialog,
      { title: 'Answer question', open, onClose: () => setOpen(false) },
      h(AnswerForm, { question, answer, setAnswer, busy, submit, error }),
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
