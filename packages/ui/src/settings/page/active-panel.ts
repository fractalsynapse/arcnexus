import { createElement as h } from 'react';
import { Button } from '../../controls/button.js';
import { SelectField } from '../../controls/select-field.js';
import { PanelOrderHandle } from './panel-order-handle.js';

interface ActivePanelProps {
  label: string;
  index: number;
  choices: ReadonlyArray<{ label: string; value: string }>;
  value: string;
  place: (value: string) => void;
  remove: () => void;
  move: (index: number) => void;
}

export function ActivePanel({
  label,
  index,
  choices,
  value,
  place,
  remove,
  move,
}: ActivePanelProps) {
  return h(
    'li',
    { 'data-panel-order': index },
    h(PanelOrderHandle, { index, label, move }),
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
