import { createElement as h, Fragment } from 'react';
import { Button } from '../controls/button.js';
import { useCommandAction } from './use-command-action.js';
import type { CommandBinding, CommandState, Operation } from './command-binding.js';

interface TriggerProps {
  state: CommandState;
  binding: CommandBinding;
  operation: Operation;
  enabled: boolean;
}

/** Use the main composer action to stop an active command while its lane is occupied. */
export function CommandTrigger({ state, binding, operation, enabled }: TriggerProps) {
  const { pending, perform, error } = useCommandAction();
  const cancel = binding.cancel?.bind(binding);
  const stop = cancel && state.canCancel && !state.supported.includes(operation);
  const label = stop ? 'Stop ' + (state.command ?? 'command') : 'Send';
  return h(
    Fragment,
    null,
    h(Button, {
      type: stop ? 'button' : 'submit',
      icon: stop ? 'stop' : 'send',
      className: stop ? 'arc-send arc-stop' : 'arc-solid arc-send',
      disabled: stop ? pending : !enabled,
      'aria-label': label,
      title: label,
      onClick: stop
        ? () => void perform(cancel, 'Cancellation could not be requested.')
        : undefined,
    }),
    error && h('p', { role: 'alert', className: 'arc-composer-error' }, error),
  );
}
