import { createElement as h } from 'react';
import { Tabs } from '../../controls/tabs.js';
import { orderedDisplays } from '../../layouts/page/page-preferences.js';
import type { PagePreferences } from '../../layouts/page/page-preferences.js';
import type { PanelRegion } from '../../layouts/panels/presets/index.js';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { ActivePanels } from './active-panels.js';
import { AvailablePanels } from './available-panels.js';

interface DisplaySettingsProps {
  panels: readonly DisplayRegistration[];
  draft: PagePreferences;
  update: (value: PagePreferences) => void;
}

export function DisplaySettings({ panels, draft, update }: DisplaySettingsProps) {
  const ordered = orderedDisplays(panels, draft.order);
  const visible = ordered.filter(({ id }) => !draft.hidden.includes(id));
  const place = (id: string, region: PanelRegion) =>
    update({ ...draft, regions: { ...draft.regions, [id]: region } });
  const show = (id: string, showPanel: boolean) =>
    update({
      ...draft,
      hidden: showPanel ? draft.hidden.filter((item) => item !== id) : [...draft.hidden, id],
    });
  return h(Tabs, {
    label: 'Page panels',
    sections: [
      {
        title: 'Active panels',
        content: h(ActivePanels, {
          visible,
          draft,
          place,
          show,
          reorder: (order) => update({ ...draft, order }),
        }),
      },
      {
        title: 'Available panels',
        content: h(AvailablePanels, { ordered, hidden: draft.hidden, show }),
      },
    ],
  });
}
