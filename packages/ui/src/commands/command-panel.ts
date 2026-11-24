import { useSyncExternalStore, useState, useId, createElement as h } from 'react';
import { Dialog } from '../controls/dialog.js';
import { useMedia } from '../hooks/use-media.js';
import type { CommandBinding } from './command-binding.js';
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
    h('div', { id: body, hidden: collapsed }, h(Composer, { state, binding, workspace })),
    h(RoundReadout, {
      state,
      collapsed,
      body,
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
