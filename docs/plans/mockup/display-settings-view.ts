import {
  colorSchemes,
  columns,
  defaultSchemeColors,
  findColorScheme,
  panelRegion,
} from './display-preferences.ts';
import type { Layout, PanelId, Preferences } from './display-preferences.ts';
import type { DisplayPanel } from './display-layout.ts';
import { schemeSelector } from './scheme-selector.ts';
import { escape, noData, options, panel } from './view.ts';

export type SettingsTab = 'active' | 'available';

const layoutNames = { 1: 'One column', 2: 'Two columns', 3: 'Three columns' };
const regionNames = { 1: ['Full width'], 2: ['Left', 'Right'], 3: ['Left', 'Center', 'Right'] };

function wireframe(count: Layout) {
  const width = (76 - 4 * (count - 1)) / count;
  return `<svg viewBox="0 0 84 38" class="arc-layout-wireframe" aria-hidden="true">
    <rect x="1" y="1" width="82" height="36" rx="3"/><path d="M1 9h82"/>
    ${Array.from({ length: count }, (_, i) => `<rect x="${4 + i * (width + 4)}" y="13" width="${width}" height="20" rx="1"/>`).join('')}
  </svg>`;
}

function layoutChoices(selected: Layout) {
  return `<fieldset class="arc-display-fieldset"><legend>Desktop layout</legend><div class="arc-layout-choices">
    ${columns
      .map(
        (
          count,
        ) => `<label><input type="radio" name="display-layout" data-display-layout value="${count}" ${count === selected ? 'checked' : ''}>
      ${wireframe(count)}<span>${layoutNames[count]}</span></label>`,
      )
      .join('')}
    </div></fieldset>`;
}

function activePanels(draft: Preferences, registry: readonly DisplayPanel[]) {
  const choices = regionNames[draft.layout].map((label, i): [string, string] => [String(i), label]);
  const rows = draft.order
    .map((id) => {
      const entry = registry.find((item) => item.id === id);
      if (!entry) return '';
      const name = escape(entry.label);
      return `<div class="arc-display-row" data-sort-row data-display-entry="${id}">
      <button type="button" class="arc-button arc-sort-handle" data-sort-handle aria-label="Reorder ${name}"
        aria-description="Drag to reorder or use the arrow keys" data-arc-tooltip="Reorder ${name}"><span class="arc-sort-grip" aria-hidden="true"></span></button>
      <strong>${name}</strong><label><span class="arc-sr">${name} region</span><select data-display-region="${id}" aria-label="${name} region">
        ${options(choices, String(panelRegion(draft, id)))}</select></label>
      <button type="button" class="arc-button" data-display-action="remove" aria-label="Remove ${name}" data-arc-tooltip="Remove ${name}">×</button>
      </div>`;
    })
    .join('');
  return (
    `<div class="arc-sort-list" data-sortable-list="display-panels">${rows}</div>` +
    (rows
      ? '<span class="arc-sr" role="status" data-sort-status></span>'
      : noData('Choose panels from the Available panels tab.'))
  );
}

function availablePanels(draft: Preferences, registry: readonly DisplayPanel[]) {
  return registry
    .map(
      ({ id, label }) => `<div class="arc-row arc-available-panel" data-display-entry="${id}">
    <strong>${escape(label)}</strong>${
      draft.order.includes(id)
        ? '<small>Added</small>'
        : `<button type="button" class="arc-button" data-display-action="add" aria-label="Add ${escape(label)}">Add</button>`
    }</div>`,
    )
    .join('');
}

function panelTabs(draft: Preferences, registry: readonly DisplayPanel[], tab: SettingsTab) {
  const names = { active: 'Active panels', available: 'Available panels' };
  const button = (
    key: SettingsTab,
  ) => `<button type="button" role="tab" id="arc-display-tab-${key}" aria-controls="arc-display-${key}"
    aria-selected="${tab === key}" tabindex="${tab === key ? 0 : -1}">${names[key]}</button>`;
  return `<div class="arc-component-tabs"><div class="arc-tabs" role="tablist" aria-label="Page panels">${button('active')}${button('available')}</div>
    <div role="tabpanel" id="arc-display-active" aria-labelledby="arc-display-tab-active" ${tab !== 'active' ? 'hidden' : ''}>
      <p class="arc-component-tab-description">List order applies on mobile and within each desktop column.</p>${activePanels(draft, registry)}</div>
    <div role="tabpanel" id="arc-display-available" aria-labelledby="arc-display-tab-available" ${tab !== 'available' ? 'hidden' : ''}>${availablePanels(draft, registry)}</div></div>`;
}

function settingsActions() {
  return `<div class="arc-row arc-display-actions"><button type="button" class="arc-button" data-display-action="close">Close</button>
    <button type="button" class="arc-button solid" data-display-action="save">Save</button></div>`;
}

export function pageSettingsView(
  title: string,
  draft: Preferences,
  registry: readonly DisplayPanel[],
  tab: SettingsTab,
) {
  const site = findColorScheme(colorSchemes.site) ?? {
    name: 'ArcNexus',
    colors: defaultSchemeColors(),
  };
  return panel(
    `${title} page settings`,
    layoutChoices(draft.layout) +
      panelTabs(draft, registry, tab) +
      schemeSelector('page', 'Page content scheme', draft.scheme, {
        name: `Use site default · ${site.name}`,
        colors: site.colors,
      }) +
      settingsActions(),
  );
}

export function panelSettingsView(draft: Preferences, id: PanelId) {
  const page = findColorScheme(draft.scheme) ??
    findColorScheme(colorSchemes.site) ?? { name: 'ArcNexus', colors: defaultSchemeColors() };
  return `<div class="arc-body arc-panel-display-settings" data-panel-display-settings><h3>Display settings</h3>
    ${schemeSelector('panel', 'Color scheme', draft.panelSchemes[id], { name: `Use page default · ${page.name}`, colors: page.colors })}${settingsActions()}</div>`;
}
