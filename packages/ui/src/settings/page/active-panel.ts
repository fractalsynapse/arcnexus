import { createElement as h } from 'react';
import { Button } from '../../controls/button.js';
import { SelectField } from '../../controls/select-field.js';
import { SortHandle } from '../../controls/sort-handle.js';

interface ActivePanelProps {
  label: string;
  choices: ReadonlyArray<{ label: string; value: string }>;
  value: string;
  place: (value: string) => void;
  remove: () => void;
}

export function ActivePanel({ label, choices, value, place, remove }: ActivePanelProps) {
  return h(
    'li',
    { 'data-sort-row': '' },
    h(SortHandle, { label }),
    h('strong', null, label),
    h(SelectField<string>, {
      label: label + ' region',
      hideLabel: true,
      value,
      options: choices,
      onChange: place,
    }),
    h(Button, { 'aria-label': 'Remove ' + label, onClick: remove }, '×'),
  );
}
