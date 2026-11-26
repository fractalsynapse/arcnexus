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
  reconnect?: () => void;
}

export function RoundReadout({
  state,
  collapsed,
  body,
  toggle,
  showMetrics,
  reconnect,
}: ReadoutProps) {
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
    roundActions({ collapsed, body, details, toggle, reconnect }),
  );
}

function roundActions({
  collapsed,
  body,
  details,
  toggle,
  reconnect,
}: Pick<ReadoutProps, 'collapsed' | 'body' | 'toggle' | 'reconnect'> & { details: string }) {
  return h(
    'div',
    { className: 'arc-round-tools' },
    reconnect &&
      h(IconButton, { icon: 'refine', label: 'Reconnect command updates', onClick: reconnect }),
    h(IconButton, {
      icon: collapsed ? 'up' : 'down',
      label: collapsed ? 'Expand command panel' : 'Collapse command panel',
      'aria-expanded': !collapsed,
      'aria-controls': body + ' ' + details,
      onClick: toggle,
    }),
  );
}
