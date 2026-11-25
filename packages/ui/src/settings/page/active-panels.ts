import { createElement as h, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { SortableLists } from '../../controls/sortable-lists.js';
import { panelRegion } from '../../layouts/page/page-preferences.js';
import type { PagePreferences } from '../../layouts/page/page-preferences.js';
import { panelLayoutFor, panelRegionsFor } from '../../layouts/panels/presets/index.js';
import type { PanelRegion } from '../../layouts/panels/presets/index.js';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { ActivePanel } from './active-panel.js';

interface ActiveProps {
  visible: readonly DisplayRegistration[];
  draft: PagePreferences;
  place: (id: string, region: PanelRegion) => void;
  show: (id: string, visible: boolean) => void;
  reorder: (order: string[]) => void;
}

export function ActivePanels(props: ActiveProps) {
  const { visible, reorder } = props;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const sorter = new SortableLists(container.current, (_list, from, to) => {
      flushSync(() => reorderPanels(visible, from, to, reorder));
    });
    return () => sorter.dispose();
  }, [visible, reorder]);
  if (!visible.length) return h('p', { className: 'arc-muted' }, 'No active panels.');
  return h(
    'div',
    { ref: container },
    h(PanelRows, props),
    h('span', { className: 'arc-sr', role: 'status', 'data-sort-status': '' }),
  );
}

function PanelRows({ visible, draft, place, show }: Omit<ActiveProps, 'reorder'>) {
  const choices = panelRegionsFor(panelLayoutFor(draft.columns));
  return h(
    'ul',
    { className: 'arc-panel-settings-list arc-sort-list', 'data-sortable-list': 'active-panels' },
    visible.map((panel) =>
      h(ActivePanel, {
        key: panel.id,
        label: panel.label,
        choices,
        value: String(panelRegion(panel, draft)),
        place: (value) => {
          const choice = choices.find((region) => region.value === value);
          if (choice) place(panel.id, choice.id);
        },
        remove: () => show(panel.id, false),
      }),
    ),
  );
}

function reorderPanels(
  panels: readonly DisplayRegistration[],
  from: number,
  to: number,
  save: (order: string[]) => void,
) {
  const id = panels[from]?.id;
  if (id === undefined || !panels[to] || from === to) return;
  const order = panels.map((panel) => panel.id);
  order.splice(from, 1);
  order.splice(to, 0, id);
  save(order);
}
