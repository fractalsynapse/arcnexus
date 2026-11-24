import { createElement as h } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './icon.js';
import type { IconName } from './icon.js';

/** Render the standard text action, with an optional icon. */
export function Button({
  icon,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  return h(
    'button',
    { type: 'button', className: ['arc-button', className].filter(Boolean).join(' '), ...props },
    icon && h(Icon, { name: icon }),
    children,
  );
}
