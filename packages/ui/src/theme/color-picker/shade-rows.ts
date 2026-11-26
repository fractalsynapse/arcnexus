import { createElement as h } from 'react';
import { moveShadeFocus } from './shade-focus.js';
import { families } from './palette.js';
import type { PickerProps } from './palette.js';
import { ShadeRow } from './shade-row.js';

/** Keep the swatch grid one Tab stop and allow arrows to move within it. */
export function ShadeRows(props: PickerProps) {
  return h(
    'div',
    {
      className: 'arc-shade-grid',
      onKeyDown: (event) => moveShadeFocus(event, event.currentTarget),
    },
    Object.entries(families).map(([name, values]) =>
      h(ShadeRow, { ...props, key: name, name, values }),
    ),
  );
}
