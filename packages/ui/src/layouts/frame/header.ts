import { createElement as h, Fragment } from 'react';
import type { ReactNode } from 'react';
import { DialogButton } from '../../controls/dialog-button.js';
import { Brand } from './brand.js';

interface HeaderProps {
  home: string;
  action?: ReactNode;
  schemes: ReactNode;
  controls: ReadonlyArray<readonly [string, ReactNode]>;
}

export function Header({ home, action, schemes, controls }: HeaderProps) {
  return h(
    'header',
    { className: 'arc-header' },
    h(Brand, { home }),
    h(
      'div',
      { className: 'arc-header-actions' },
      controls.map(([id, control]) => h(Fragment, { key: id }, control)),
      h(DialogButton, { icon: 'palette', title: 'Color schemes', children: schemes }),
      action,
    ),
  );
}
