import { createElement as h } from 'react';
import { DisplayPanel } from '../../displays/display-panel.js';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { panelRegion } from '../page/page-preferences.js';
import type { PagePreferences } from '../page/page-preferences.js';
import type { PanelRegion } from './presets/index.js';

export function DisplayRegion({
  active,
  preferences,
  region,
  workspace,
}: {
  active: readonly DisplayRegistration[];
  preferences: PagePreferences;
  region: PanelRegion;
  workspace: string;
}) {
  const panels = active.flatMap((panel, order) =>
    panelRegion(panel, preferences) === region
      ? [h(DisplayPanel, { key: panel.id, panel, order, workspace })]
      : [],
  );
  const width = typeof region === 'number' ? 'column' : 'band';
  if (width === 'band' && !panels.length) return null;
  return h(
    'div',
    { className: 'arc-layout-region arc-layout-' + width, 'data-region': region },
    panels,
  );
}
