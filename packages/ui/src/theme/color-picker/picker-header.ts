import { createElement as h } from 'react';
import { Icon } from '../../controls/icon.js';
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
    h(
      'button',
      {
        type: 'button',
        className: 'arc-icon-button',
        'aria-label': 'Close ' + field + ' picker',
        popoverTarget: id,
        popoverTargetAction: 'hide',
      },
      h(Icon, { name: 'close' }),
    ),
  );
}
