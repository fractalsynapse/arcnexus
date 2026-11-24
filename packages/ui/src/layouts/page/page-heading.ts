import { createElement as h } from 'react';
import type { Ref } from 'react';
import { IconButton } from '../../controls/icon-button.js';

export function PageHeading({
  label,
  title,
  heading,
  gear,
  settings,
  toggle,
}: {
  label: string;
  title: string;
  heading: Ref<HTMLHeadingElement>;
  gear: Ref<HTMLButtonElement>;
  settings: boolean;
  toggle: () => void;
}) {
  return h(
    'div',
    { className: 'arc-page-heading' },
    h(IconButton, {
      icon: 'settings',
      label: title,
      ref: gear,
      'aria-expanded': settings,
      onClick: toggle,
    }),
    h('h1', { ref: heading, tabIndex: -1 }, label),
  );
}
