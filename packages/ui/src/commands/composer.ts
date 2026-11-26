import { createElement as h } from 'react';
import { CommandTrigger } from './command-trigger.js';
import { InstructionField } from './instruction-field.js';
import { OperationField } from './operation-field.js';
import { useComposer } from './use-composer.js';
import type { ComposerProps } from './use-composer.js';

export function Composer(props: ComposerProps) {
  const { instruction, setInstruction, options, operation, setSelection, enabled, send, error } =
    useComposer(props);
  return h(
    'form',
    { className: 'arc-composer', onSubmit: send },
    h(InstructionField, { instruction, setInstruction }),
    h(OperationField, { options, operation, setSelection }),
    h(CommandTrigger, { state: props.state, binding: props.binding, operation, enabled }),
    error && h('p', { role: 'alert', className: 'arc-composer-error' }, error),
  );
}
