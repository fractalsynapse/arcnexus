import { createElement as h, useLayoutEffect, useRef, type ReactElement } from 'react';
import { IconButton } from '../controls/icon-button.js';
import { ExpansionButton } from '../controls/expansion-button.js';
import { SurfaceHeading } from './surface-heading.js';

interface DisplayHeadingProps {
  label: string;
  title: string;
  settings: boolean;
  expanded: boolean;
  toggleSettings: () => void;
  toggleFocus?: () => void;
}

/** Give registered components one action to expand and collapse their display. */
export function DisplayHeading(props: DisplayHeadingProps): ReactElement {
  const { label, title, settings, expanded, toggleFocus } = props;
  return h(SurfaceHeading, {
    settings: h(IconButton, {
      icon: 'settings',
      label: label + ' settings',
      'aria-expanded': settings,
      onClick: props.toggleSettings,
    }),
    heading: h('h2', { id: title }, label),
    actions: toggleFocus && h(DisplayToggle, { label, expanded, toggleFocus }),
  });
}

function DisplayToggle({
  label,
  expanded,
  toggleFocus,
}: Pick<DisplayHeadingProps, 'label' | 'expanded' | 'toggleFocus'>) {
  const control = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (control.current === document.activeElement)
      control.current?.scrollIntoView({ block: 'nearest' });
  }, [expanded]);
  return h(ExpansionButton, {
    ref: control,
    label,
    expanded,
    onClick: toggleFocus,
  });
}
