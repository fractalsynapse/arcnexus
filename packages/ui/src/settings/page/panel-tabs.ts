import { createElement as h } from 'react';
import { Button } from '../../controls/button.js';

export function PanelTabs({
  available,
  setAvailable,
}: {
  available: boolean;
  setAvailable: (value: boolean) => void;
}) {
  return h(
    'div',
    { className: 'arc-settings-tabs', role: 'group', 'aria-label': 'Page panels' },
    h(Button, { 'aria-pressed': !available, onClick: () => setAvailable(false) }, 'Active panels'),
    h(Button, { 'aria-pressed': available, onClick: () => setAvailable(true) }, 'Available panels'),
  );
}
