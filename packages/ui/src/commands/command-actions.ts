import { createElement as h } from 'react';
import { Button } from '../controls/button.js';
import type { CommandBinding, CommandState } from './command-binding.js';
import { useCommandAction } from './use-command-action.js';
import { CommandQuestion } from './command-question.js';

export function CommandActions({
  state,
  binding,
}: {
  state: CommandState;
  binding: CommandBinding;
}) {
  const { pending, perform, error } = useCommandAction();
  const cancel = () =>
    void perform(() => binding.cancel!(), 'Cancellation could not be requested.');
  return h(
    'div',
    { className: 'arc-command-actions' },
    answerControl(state.gate, binding),
    state.canCancel &&
      binding.cancel &&
      h(Button, { onClick: cancel, disabled: pending }, 'Cancel command'),
    state.canReconnect &&
      binding.reconnect &&
      h(Button, { onClick: binding.reconnect }, 'Reconnect commands'),
    (error || state.connectionError) &&
      h('span', { role: 'status' }, error || state.connectionError),
  );
}

function answerControl(gate: CommandState['gate'], binding: CommandBinding) {
  if (gate && binding.answer)
    return h(CommandQuestion, {
      key: gate.key,
      question: gate.question,
      send: (answer) => binding.answer!(gate.key, answer),
    });
}
