import { createElement as h, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Button } from './controls.js';
import { SelectField } from './fields.js';
import {
  columnCounts,
  orderedDisplays,
  panelColumn,
  type ColumnCount,
  type PagePreferences,
} from './page-preferences.js';
import type { DisplayRegistration } from './types.js';

interface SettingsProps {
  title: string;
  preferences: PagePreferences;
  panels: readonly DisplayRegistration[];
  save: (value: PagePreferences) => void;
  close: () => void;
}

/** Edit a registered workspace layout without binding the editor to page-specific content. */
export function PageSettings({ title, preferences, panels, save, close }: SettingsProps) {
  const [draft, setDraft] = useState(preferences);
  return h(
    'section',
    { className: 'arc-surface arc-page-settings', 'aria-label': title },
    h('h2', null, title),
    h(LayoutChoices, {
      columns: draft.columns,
      choose: (columns) => {
        if (columns !== draft.columns) setDraft({ ...draft, columns, widths: [] });
      },
    }),
    h(DisplaySettings, { panels, draft, update: setDraft }),
    h(
      'div',
      { className: 'arc-form-actions arc-settings-actions' },
      h(Button, { onClick: close }, 'Close'),
      h(Button, { className: 'arc-solid', onClick: () => save(draft) }, 'Save'),
    ),
  );
}

const layoutLabels = ['One column', 'Two columns', 'Three columns'] as const;
const regionLabels = { 1: ['Full width'], 2: ['Left', 'Right'], 3: ['Left', 'Center', 'Right'] };

function LayoutChoices({
  columns,
  choose,
}: {
  columns: ColumnCount;
  choose: (value: ColumnCount) => void;
}) {
  return h(
    'fieldset',
    { className: 'arc-layout-choices' },
    h('legend', null, 'Desktop layout'),
    h(
      'div',
      null,
      columnCounts.map((value) =>
        h(LayoutChoice, { key: value, value, selected: columns === value, choose }),
      ),
    ),
  );
}

function LayoutChoice({
  value,
  selected,
  choose,
}: {
  value: ColumnCount;
  selected: boolean;
  choose: (value: ColumnCount) => void;
}) {
  return h(
    'label',
    null,
    h('input', {
      type: 'radio',
      name: 'desktop-layout',
      value,
      checked: selected,
      onChange: () => choose(value),
    }),
    h(
      'span',
      { className: 'arc-layout-diagram', 'aria-hidden': true },
      Array.from({ length: value }, (_, index) => h('i', { key: index })),
    ),
    layoutLabels[value - 1],
  );
}

interface DisplaySettingsProps {
  panels: readonly DisplayRegistration[];
  draft: PagePreferences;
  update: (value: PagePreferences) => void;
}

function DisplaySettings({ panels, draft, update }: DisplaySettingsProps) {
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

function PanelTabs({
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

function AvailablePanels({
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

interface ActiveProps {
  visible: readonly DisplayRegistration[];
  draft: PagePreferences;
  place: (id: string, region: string) => void;
  show: (id: string, visible: boolean) => void;
  reorder: (order: string[]) => void;
}

function ActivePanels({ visible, draft, place, show, reorder }: ActiveProps) {
  const choices = regionLabels[draft.columns].map((label, index) => ({
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

interface ActivePanelProps {
  label: string;
  index: number;
  choices: ReadonlyArray<{ label: string; value: string }>;
  value: string;
  place: (value: string) => void;
  remove: () => void;
  move: (index: number) => void;
}

function ActivePanel({ label, index, choices, value, place, remove, move }: ActivePanelProps) {
  return h(
    'li',
    { 'data-panel-order': index },
    h(PanelOrderHandle, { index, label, move }),
    h('strong', null, label),
    h(SelectField<string>, {
      label: label + ' region',
      hideLabel: true,
      value,
      options: choices,
      onChange: place,
    }),
    h(Button, { 'aria-label': 'Remove ' + label, onClick: remove }, '×'),
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

interface OrderHandleProps {
  index: number;
  label: string;
  move: (index: number) => void;
}

function PanelOrderHandle({ index, label, move }: OrderHandleProps) {
  const key = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    move(index + step);
  };
  return h(
    Button,
    {
      className: 'arc-order-handle',
      'aria-label': 'Reorder ' + label,
      'aria-description': 'Drag or use up and down arrow keys',
      onKeyDown: key,
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => dropPanel(event, move),
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) =>
        event.currentTarget.setPointerCapture(event.pointerId),
    },
    '⠿',
  );
}

function dropPanel(event: PointerEvent<HTMLButtonElement>, move: (index: number) => void) {
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-panel-order]');
  if (row?.dataset.panelOrder !== undefined) move(Number(row.dataset.panelOrder));
}
