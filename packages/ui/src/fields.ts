import { createElement as h, useId } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

export interface SelectProps<Value extends string> {
  label: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
  className?: string;
  prefix?: ReactNode;
  hideLabel?: boolean;
}

/** Render a labeled, theme-aware selector with optional inline display beside it. */
export function SelectField<Value extends string>(props: SelectProps<Value>) {
  const { label, value, options, onChange, className, prefix, hideLabel } = props;
  const id = useId();
  const select = h(
    'select',
    {
      id,
      value,
      onChange: ({ currentTarget }: ChangeEvent<HTMLSelectElement>) =>
        onChange(currentTarget.value as Value),
    },
    options.map((choice) => h('option', { key: choice.value, value: choice.value }, choice.label)),
  );
  return h(
    'div',
    { className: ['arc-field', className].filter(Boolean).join(' ') },
    h('label', { htmlFor: id, className: hideLabel ? 'arc-sr' : undefined }, label),
    prefix ? h('div', { className: 'arc-field-with-prefix' }, prefix, select) : select,
  );
}
