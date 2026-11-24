import { createElement as h } from 'react';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { Icon } from './icon.js';
import type { IconName } from './icon.js';
import { Tooltip } from './tooltip.js';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Provide the visible tooltip and accessible name for a compact action. */
export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return h(
    Tooltip,
    { label },
    h(
      'button',
      {
        type: 'button',
        className: ('arc-icon-button ' + className).trim(),
        'aria-label': label,
        ...props,
      },
      h(Icon, { name: icon }),
    ),
  );
}
