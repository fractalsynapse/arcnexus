import { createElement as h } from 'react';

interface CheckboxProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** Make the label and native checkbox act as one touch target. */
export function CheckboxField({ label, checked, disabled, onChange }: CheckboxProps) {
  return h(
    'label',
    { className: 'arc-checkbox' },
    h('input', {
      type: 'checkbox',
      checked,
      disabled,
      onChange: (event) => onChange(event.currentTarget.checked),
    }),
    label,
  );
}
