import { useId, createElement as h } from 'react';
import type { ReactNode } from 'react';
import * as Select from '@radix-ui/react-select';
import { Icon } from './icon.js';

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
  const labelId = id + '-label';
  const select = h(
    Select.Root,
    {
      value: optionKey(value),
      onValueChange: (choice) => onChange(choice.slice(1) as Value),
      disabled: !options.length,
    },
    h(
      Select.Trigger,
      { id, 'aria-labelledby': labelId, className: 'arc-select-trigger' },
      h(Select.Value, { className: 'arc-select-value' }),
      h(Select.Icon, { asChild: true }, h(Icon, { name: 'down' })),
    ),
    selectMenu(options, labelId),
  );
  return h(
    'div',
    { className: ['arc-field', className].filter(Boolean).join(' ') },
    h('label', { id: labelId, htmlFor: id, className: hideLabel ? 'arc-sr' : undefined }, label),
    prefix ? h('div', { className: 'arc-field-with-prefix' }, prefix, select) : select,
  );
}

function selectMenu(options: SelectProps<string>['options'], label: string) {
  return h(
    Select.Content,
    {
      className: 'arc-select-menu',
      position: 'popper',
      align: 'end',
      sideOffset: 4,
      'aria-labelledby': label,
    },
    h(
      Select.Viewport,
      null,
      options.map(({ value, label }) =>
        h(
          Select.Item,
          { key: value, value: optionKey(value), className: 'arc-select-option' },
          h(Select.ItemText, null, label),
        ),
      ),
    ),
  );
}

/** Preserve empty domain values as options, since the select reserves the empty string. */
function optionKey(value: string) {
  return ':' + value;
}
