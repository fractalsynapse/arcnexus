import { createElement as h } from 'react';
import type { ReactNode } from 'react';

interface HeadingProps {
  className?: string;
  settings?: ReactNode;
  heading: ReactNode;
  actions?: ReactNode;
}

/** Arrange settings, title and contextual actions consistently across surfaces. */
export function SurfaceHeading({ className, settings, heading, actions }: HeadingProps) {
  return h(
    'div',
    { className: ['arc-surface-heading', className].filter(Boolean).join(' ') },
    settings,
    heading,
    actions && h('div', { className: 'arc-surface-heading-actions' }, actions),
  );
}
