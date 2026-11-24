import { createElement as h } from 'react';
import { DisplayPanel } from '../../displays/display-panel.js';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { panelColumn } from '../page/page-preferences.js';
import type { PagePreferences } from '../page/page-preferences.js';

export function DisplayColumn({
  active,
  preferences,
  column,
}: {
  active: readonly DisplayRegistration[];
  preferences: PagePreferences;
  column: number;
}) {
  return h(
    'div',
    { className: 'arc-layout-column' },
    active.map((panel, order) =>
      panelColumn(panel, preferences) === column
        ? h(DisplayPanel, { key: panel.id, panel, order })
        : null,
    ),
  );
}
