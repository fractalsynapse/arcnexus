import { createElement as h, useSyncExternalStore } from 'react';
import { Button, useCommandAction, type CommandBinding } from '../../../packages/ui/src/index.js';

/** Submit the header action through the same binding as the dock. */
export function RefineButton({ binding }: { binding: CommandBinding }) {
  const state = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  return h(RefineAction, {
    key: state.scope,
    start: binding.refine,
    enabled: !!state.supported.length && !state.recommendationOnly,
  });
}

function RefineAction({ enabled, start }: { enabled: boolean; start?: () => Promise<void> }) {
  const { pending, perform, error } = useCommandAction();
  return h(
    'div',
    null,
    h(
      Button,
      {
        icon: 'refine',
        disabled: pending || !enabled || !start,
        onClick: () => {
          if (start) void perform(start, 'Refine could not start.');
        },
      },
      'Refine',
    ),
    error && h('span', { role: 'alert' }, error),
  );
}
