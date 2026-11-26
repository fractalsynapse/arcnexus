import { createElement as h } from 'react';
import { IconButton } from '../../controls/icon-button.js';
import type { ColorField } from './palette.js';

export function PickerHeader({
  id,
  title,
  field,
}: {
  id: string;
  title: string;
  field: ColorField;
}) {
  return h(
    'header',
    { className: 'arc-dialog-header' },
    h('h3', { id: id + '-title' }, title),
    h(IconButton, {
      icon: 'close',
      label: 'Close ' + field + ' picker',
      popoverTarget: id,
      popoverTargetAction: 'hide',
    }),
  );
}
