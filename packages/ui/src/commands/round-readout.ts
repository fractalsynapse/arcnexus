import { useId, createElement as h } from 'react';
import { IconButton } from '../controls/icon-button.js';
import type { CommandState } from './command-binding.js';
import { RoundValues } from './round-values.js';

interface ReadoutProps {
  state: CommandState;
  collapsed: boolean;
  body: string;
  toggle: () => void;
  showMetrics: () => void;
}

export function RoundReadout({ state, collapsed, body, toggle, showMetrics }: ReadoutProps) {
  const details = useId();
  return h(
    'div',
    { className: 'arc-command-readout', role: 'group', 'aria-label': 'Round state' },
    h(IconButton, {
      icon: 'metrics',
      label: 'Round metrics',
      'aria-haspopup': 'dialog',
      onClick: showMetrics,
    }),
    h(RoundValues, { state, collapsed, details }),
    h(IconButton, {
      icon: collapsed ? 'up' : 'down',
      label: collapsed ? 'Expand command panel' : 'Collapse command panel',
      'aria-expanded': !collapsed,
      'aria-controls': body + ' ' + details,
      onClick: toggle,
    }),
  );
}
