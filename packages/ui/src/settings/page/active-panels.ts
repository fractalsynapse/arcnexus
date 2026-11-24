import { createElement as h } from 'react';
import { panelColumn } from '../../layouts/page/page-preferences.js';
import type { PagePreferences } from '../../layouts/page/page-preferences.js';
import { panelLayoutFor } from '../../layouts/panels/presets/index.js';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { ActivePanel } from './active-panel.js';

interface ActiveProps {
  visible: readonly DisplayRegistration[];
  draft: PagePreferences;
  place: (id: string, region: string) => void;
  show: (id: string, visible: boolean) => void;
  reorder: (order: string[]) => void;
}

export function ActivePanels({ visible, draft, place, show, reorder }: ActiveProps) {
  const choices = panelLayoutFor(draft.columns).regions.map((label, index) => ({
    label,
    value: String(index),
  }));
  if (!visible.length) return h('p', { className: 'arc-muted' }, 'No active panels.');
  return h(
    'ul',
    { className: 'arc-panel-settings-list' },
    visible.map((panel, index) =>
      h(ActivePanel, {
        key: panel.id,
        label: panel.label,
        index,
        choices,
        value: String(panelColumn(panel, draft)),
        place: (value) => place(panel.id, value),
        remove: () => show(panel.id, false),
        move: (next) => reorderPanels(visible, index, next, reorder),
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
