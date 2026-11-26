import { useSyncExternalStore, useState, useId, createElement as h } from 'react';
import { Dialog } from '../controls/dialog.js';
import { useMedia } from '../hooks/use-media.js';
import type { CommandState, CommandBinding } from './command-binding.js';
import { CommandActions } from './command-actions.js';
import { Composer } from './composer.js';
import { RoundMetrics } from './round-metrics.js';
import { RoundReadout } from './round-readout.js';

export interface DockProps {
  binding: CommandBinding;
  workspace: string;
}

/** Render the docked composer and round state from the injected command binding. */
export function CommandPanel({ binding, workspace }: DockProps) {
  const state = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const mobile = useMedia('(max-width: 590px)');
  const [override, setOverride] = useState<boolean>();
  const [metrics, setMetrics] = useState(false);
  const collapsed = override ?? mobile;
  const body = useId();
  return h(
    'footer',
    {
      className: 'arc-command-panel',
      'aria-label': 'Command controls',
      'data-collapsed': collapsed || undefined,
    },
    h(DockControls, { body, collapsed, state, binding, workspace }),
    h(RoundReadout, {
      state,
      collapsed,
      body,
      reconnect: state.canReconnect ? binding.reconnect : undefined,
      toggle: () => setOverride(!collapsed),
      showMetrics: () => setMetrics(true),
    }),
    h(
      Dialog,
      { title: 'End-to-end refinement metrics', open: metrics, onClose: () => setMetrics(false) },
      h(RoundMetrics, { state }),
    ),
  );
}

function DockControls({
  body,
  collapsed,
  state,
  binding,
  workspace,
}: DockProps & {
  body: string;
  collapsed: boolean;
  state: CommandState;
}) {
  return [
    h(
      'div',
      { id: body, hidden: collapsed, key: 'composer' },
      h(Composer, { state, binding, workspace, key: state.scope }),
    ),
    state.gate && h(CommandActions, { state, binding, key: 'actions:' + state.scope }),
  ];
}
