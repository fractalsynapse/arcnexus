import { createElement as h } from 'react';
import type { CommandBinding, CommandState } from './command-binding.js';
import { CommandQuestion } from './command-question.js';

export function CommandActions({
  state,
  binding,
}: {
  state: CommandState;
  binding: CommandBinding;
}) {
  const { gate } = state;
  if (gate && binding.answer)
    return h(
      'div',
      { className: 'arc-command-actions' },
      h(CommandQuestion, {
        key: gate.key,
        identity: gate.key,
        question: gate.question,
        review: gate.review,
        send: (answer) => binding.answer!(gate.key, answer),
      }),
    );
  return null;
}
