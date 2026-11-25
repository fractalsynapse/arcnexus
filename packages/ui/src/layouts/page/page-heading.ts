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
  titleAction?: ReactNode;
  context?: ReactNode;
}

export function PageHeading({
  label,
  title,
  heading,
  gear,
  settings,
  toggle,
  titleAction,
  context,
}: PageHeadingProps): ReactElement {
  const titleElement = h('h1', { ref: heading, tabIndex: -1 }, label);
  return h(SurfaceHeading, {
    className: 'arc-page-heading',
    settings: h(IconButton, {
      icon: 'settings',
      label: title,
      ref: gear,
      'aria-expanded': settings,
      onClick: toggle,
    }),
    heading: titleAction
      ? h('div', { className: 'arc-page-title' }, titleElement, titleAction)
      : titleElement,
    actions: context && h('div', { className: 'arc-page-context' }, context),
  });
}
