import { createElement as h, type ComponentProps, type ReactElement } from 'react';
import { IconButton } from './icon-button.js';

type ExpansionProps = Omit<
  ComponentProps<typeof IconButton>,
  'icon' | 'aria-expanded' | 'className'
> & {
  expanded: boolean;
  direction?: 'vertical' | 'panel';
};

/** Give expansion controls one accessible label, icon treatment and right inset. */
export function ExpansionButton({
  label,
  expanded,
  direction = 'panel',
  ...props
}: ExpansionProps): ReactElement {
  const [expand, collapse] =
    direction === 'vertical' ? (['up', 'down'] as const) : (['expand', 'restore'] as const);
  return h(IconButton, {
    ...props,
    className: 'arc-expansion-button',
    icon: expanded ? collapse : expand,
    label: (expanded ? 'Collapse ' : 'Expand ') + label,
    'aria-expanded': expanded,
  });
}
