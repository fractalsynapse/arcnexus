import { createElement as h } from 'react';
import type { ChangeEvent } from 'react';

export function InstructionField({
  instruction,
  setInstruction,
}: {
  instruction: string;
  setInstruction: (value: string) => void;
}) {
  return h(
    'label',
    { className: 'arc-instruction' },
    h('span', null, 'Instruction ', h('small', null, 'optional')),
    h('textarea', {
      rows: 1,
      value: instruction,
      placeholder: 'Add an instruction…',
      onChange: ({ currentTarget }: ChangeEvent<HTMLTextAreaElement>) =>
        setInstruction(currentTarget.value),
    }),
  );
}
