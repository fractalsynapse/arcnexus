import { createElement as h, type ReactElement } from 'react';
import { IconButton } from '../controls/icon-button.js';
import { SurfaceHeading } from './surface-heading.js';

interface DisplayHeadingProps {
  label: string;
  title: string;
  settings: boolean;
  expanded: boolean;
  minimized: boolean;
  toggleSettings: () => void;
  toggleFocus?: () => void;
  toggleMinimized: () => void;
}

/** Give registered components the same settings, focus and minimize controls. */
export function DisplayHeading(props: DisplayHeadingProps): ReactElement {
  const { label, title, settings, minimized, expanded, toggleFocus } = props;
  return h(SurfaceHeading, {
    settings: h(IconButton, {
      icon: 'settings',
      label: label + ' settings',
      'aria-expanded': settings,
      onClick: props.toggleSettings,
    }),
    heading: h('h2', { id: title }, label),
    actions: [
      toggleFocus &&
        h(IconButton, {
          key: 'focus',
          icon: expanded ? 'restore' : 'expand',
          label: (expanded ? 'Restore ' : 'Expand ') + label,
          'aria-pressed': expanded,
          onClick: toggleFocus,
        }),
      h(IconButton, {
        key: 'minimize',
        icon: minimized ? 'down' : 'up',
        label: (minimized ? 'Show ' : 'Minimize ') + label,
        'aria-expanded': !minimized,
        onClick: props.toggleMinimized,
      }),
    ],
  });
}
