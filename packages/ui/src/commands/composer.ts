import { createElement as h } from 'react';
import { CheckboxField } from '../controls/checkbox-field.js';
import { CommandTrigger } from './command-trigger.js';
import { InstructionField } from './instruction-field.js';
import { OperationField } from './operation-field.js';
import { useComposer, type ComposerProps } from './use-composer.js';

export function Composer(props: ComposerProps) {
  const {
    instruction,
    setInstruction,
    options,
    operation,
    setSelection,
    enabled,
    send,
    error,
    recommendation,
  } = useComposer(props);
  return h(
    'form',
    { className: 'arc-composer', onSubmit: send },
    h(InstructionField, { instruction, setInstruction }),
    h(OperationField, { options, operation, setSelection }),
    h(CommandTrigger, { state: props.state, binding: props.binding, operation, enabled }),
    recommendation &&
      h(
        'div',
        { className: 'arc-operation-options', role: 'group', 'aria-label': 'Plan options' },
        h(CheckboxField, { label: 'Recommend objectives', ...recommendation }),
      ),
    error && h('p', { role: 'alert', className: 'arc-composer-error' }, error),
  );
}
