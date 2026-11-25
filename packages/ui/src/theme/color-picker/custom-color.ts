import { useRef, createElement as h } from 'react';
import type { KeyboardEvent } from 'react';
import { normalizeHex, type PickerProps } from './palette.js';
import { Button } from '../../controls/button.js';

export function CustomColor({ color, pick }: Pick<PickerProps, 'color' | 'pick'>) {
  const input = useRef<HTMLInputElement>(null);
  const choose = () => {
    const field = input.current;
    if (!field?.reportValidity()) return;
    pick(normalizeHex(field.value));
  };
  return h(
    'div',
    { className: 'arc-color-custom' },
    h(
      'label',
      null,
      'Custom hex color',
      h('input', {
        ref: input,
        defaultValue: color,
        pattern: '#?[0-9a-fA-F]{6}',
        required: true,
        form: '',
        spellCheck: false,
        autoComplete: 'off',
        title: 'Enter a six-digit hex color.',
        onKeyDown: (event) => confirmWithEnter(event, choose),
      }),
    ),
    h(Button, { onClick: choose }, 'Use color'),
  );
}

function confirmWithEnter(event: KeyboardEvent, choose: () => void) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  choose();
}
