import { createElement as h } from 'react';
import { useWidthDrag } from './use-width-drag.js';
import type { DividerProps } from './use-width-drag.js';

export function ColumnDivider(props: DividerProps) {
  const { column, widths } = props;
  const handlers = useWidthDrag(props);
  const left = widths[column] ?? 1;
  const right = widths[column + 1] ?? 1;
  return h(
    'button',
    {
      type: 'button',
      className: 'arc-column-divider',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Resize columns ' + (column + 1) + ' and ' + (column + 2),
      'aria-valuenow': Math.round((100 * left) / (left + right)),
      ...handlers,
    },
    h('span', { 'aria-hidden': true }),
  );
}
