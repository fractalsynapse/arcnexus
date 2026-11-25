import { createElement as h } from 'react';
import type { ReactElement, ReactNode, Ref } from 'react';
import { IconButton } from '../../controls/icon-button.js';
import { SurfaceHeading } from '../../displays/surface-heading.js';

interface PageHeadingProps {
  label: string;
  title: string;
  heading: Ref<HTMLHeadingElement>;
  gear: Ref<HTMLButtonElement>;
  settings: boolean;
  toggle: () => void;
  context?: ReactNode;
}

export function PageHeading({
  label,
  title,
  heading,
  gear,
  settings,
  toggle,
  context,
}: PageHeadingProps): ReactElement {
  return h(SurfaceHeading, {
    className: 'arc-page-heading',
    settings: h(IconButton, {
      icon: 'settings',
      label: title,
      ref: gear,
      'aria-expanded': settings,
      onClick: toggle,
    }),
    heading: h('h1', { ref: heading, tabIndex: -1 }, label),
    actions: context && h('div', { className: 'arc-page-context' }, context),
  });
}
