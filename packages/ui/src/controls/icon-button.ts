import { createElement as h } from 'react';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { Button } from './button.js';
import type { IconName } from './icon.js';
import { Tooltip } from './tooltip.js';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Provide the visible tooltip and accessible name for a compact action. */
export function IconButton({ icon, label, ...props }: IconButtonProps) {
  return h(Tooltip, { label }, h(Button, { ...props, icon, variant: 'icon', 'aria-label': label }));
}
