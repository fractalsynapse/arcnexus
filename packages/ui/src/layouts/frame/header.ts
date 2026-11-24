import { createElement as h } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from '../../controls/icon-button.js';
import { Brand } from './brand.js';
import type { Navigate } from './use-workspace-path.js';

interface HeaderProps {
  home: string;
  navigate: Navigate;
  action?: ReactNode;
  openSchemes: () => void;
}

export function Header({ home, navigate, action, openSchemes }: HeaderProps) {
  return h(
    'header',
    { className: 'arc-header' },
    h(Brand, { home, navigate }),
    h(
      'div',
      { className: 'arc-header-actions' },
      h(IconButton, {
        icon: 'palette',
        label: 'Color schemes',
        'aria-haspopup': 'dialog',
        onClick: openSchemes,
      }),
      action,
    ),
  );
}
