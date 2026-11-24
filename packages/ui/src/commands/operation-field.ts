import { createElement as h } from 'react';
import { SelectField } from '../controls/select-field.js';
import { operations } from './command-binding.js';
import type { Operation } from './command-binding.js';

export function OperationField({
  options,
  operation,
  setSelection,
}: {
  options: readonly Operation[];
  operation: Operation;
  setSelection: (value: Operation) => void;
}) {
  return h(SelectField<Operation>, {
    label: 'Operation',
    value: operation,
    className: 'arc-operation',
    onChange: setSelection,
    options: options.map((value) => ({ value, label: operations[value] })),
  });
}
