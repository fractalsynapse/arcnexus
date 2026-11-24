import { createElement as h } from 'react';
import { Button } from '../../controls/button.js';
import type { DisplayRegistration } from '../../registry/workspace.js';

export function AvailablePanels({
  ordered,
  hidden,
  show,
}: {
  ordered: readonly DisplayRegistration[];
  hidden: readonly string[];
  show: (id: string, visible: boolean) => void;
}) {
  if (!ordered.length) return h('p', { className: 'arc-muted' }, 'No panels registered.');
  return h(
    'ul',
    { className: 'arc-panel-settings-list' },
    ordered.map(({ id, label }) =>
      h(
        'li',
        { key: id },
        h('strong', null, label),
        hidden.includes(id)
          ? h(Button, { 'aria-label': 'Add ' + label, onClick: () => show(id, true) }, 'Add')
          : h('small', null, 'Added'),
      ),
    ),
  );
}
