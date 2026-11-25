import { createElement as h } from 'react';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { Icon } from './icon.js';
import type { IconName } from './icon.js';

const variants = { text: 'arc-button', icon: 'arc-icon-button', plain: '' } as const;

/** Render the standard text action, with an optional icon. */
export function Button({
  icon,
  children,
  className,
  variant = 'text',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
  variant?: keyof typeof variants;
  ref?: Ref<HTMLButtonElement>;
}) {
  return h(
    'button',
    {
      type: 'button',
      className: [variants[variant], className].filter(Boolean).join(' '),
      ...props,
    },
    icon && h(Icon, { name: icon }),
    children,
  );
}
