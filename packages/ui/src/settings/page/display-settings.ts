import { useState, createElement as h } from 'react';
import { orderedDisplays } from '../../layouts/page/page-preferences.js';
import type { PagePreferences } from '../../layouts/page/page-preferences.js';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { ActivePanels } from './active-panels.js';
import { AvailablePanels } from './available-panels.js';
import { PanelTabs } from './panel-tabs.js';

interface DisplaySettingsProps {
  panels: readonly DisplayRegistration[];
  draft: PagePreferences;
  update: (value: PagePreferences) => void;
}

export function DisplaySettings({ panels, draft, update }: DisplaySettingsProps) {
  const [available, setAvailable] = useState(false);
  const ordered = orderedDisplays(panels, draft.order);
  const visible = ordered.filter(({ id }) => !draft.hidden.includes(id));
  const place = (id: string, region: string) =>
    update({ ...draft, regions: { ...draft.regions, [id]: Number(region) } });
  const show = (id: string, showPanel: boolean) =>
    update({
      ...draft,
      hidden: showPanel ? draft.hidden.filter((item) => item !== id) : [...draft.hidden, id],
    });
  return h(
    'div',
    { className: 'arc-display-settings' },
    h(PanelTabs, { available, setAvailable }),
    available
      ? h(AvailablePanels, { ordered, hidden: draft.hidden, show })
      : h(ActivePanels, {
          visible,
          draft,
          place,
          show,
          reorder: (order) => update({ ...draft, order }),
        }),
  );
}
