import { createElement as h } from 'react';
import { Button } from './button.js';
import { Tooltip } from './tooltip.js';

/** Attach the shared sorter to a labeled, keyboard-accessible grip. */
export function SortHandle({ label }: { label: string }) {
  const name = 'Reorder ' + label;
  const attributes = { 'data-sort-handle': '' };
  return h(
    Tooltip,
    { label: name },
    h(
      Button,
      {
        className: 'arc-sort-handle',
        ...attributes,
        'aria-label': name,
        'aria-description': 'Drag to reorder or use the arrow keys',
      },
      h('span', { className: 'arc-sort-grip', 'aria-hidden': true }),
    ),
  );
}
