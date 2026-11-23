import { applyPalette } from './display-colors.ts';
import {
  colorSchemes,
  defaultDisplay,
  display,
  findColorScheme,
  openDisplay,
  panelRegion,
  saveDisplay,
} from './display-preferences.ts';
import type { PanelId } from './display-preferences.ts';
import { main, root, state } from './model.ts';
import { updateWorkspace } from './panels.ts';
import { escape, icons, noData } from './view.ts';

export type DisplayPanel = {
  id: PanelId;
  label: string;
  section: HTMLElement;
  unit: HTMLElement;
};
export const desktopDisplay = matchMedia('(min-width: 900px)');
export let pagePanels: readonly DisplayPanel[] = [];
export let displayPageTitle = '';
let host: HTMLElement = main;
let grid: HTMLElement | undefined;
let nativeGroups: HTMLElement[] = [];

function displayGear(scope: string, label: string) {
  return `<button type="button" class="arc-link arc-display-gear" data-display-open="${escape(scope)}"
    aria-label="${escape(label)}" data-arc-tooltip="${escape(label)}"><span aria-hidden="true">⚙</span></button>`;
}

export function mountDisplayPage() {
  const title = main.querySelector('.arc-title h1');
  displayPageTitle = title?.textContent ?? '';
  title?.insertAdjacentHTML(
    'beforebegin',
    displayGear('page', `${displayPageTitle} page settings`),
  );
  host = main.querySelector('form[data-form="file"]') ?? main;
  grid = undefined;
  pagePanels = findPanels();
  const candidates = [...host.children, ...main.querySelectorAll(':scope > .arc-live-log')];
  nativeGroups = [...new Set(candidates)].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && pagePanels.some(({ unit }) => child.contains(unit)),
  );
  openDisplay(state.route, pageDefaults(), pagePanels, displayPageTitle);
  main.insertAdjacentHTML('beforeend', '<div id="arc-page-settings" hidden></div>');
  applyDisplay();
  arrangeDisplay();
}

function findPanels() {
  const used = new Set<string>();
  return Array.from(main.querySelectorAll<HTMLElement>('.arc-surface')).flatMap((section) => {
    if (section.parentElement?.closest('.arc-surface')) return [];
    const heading = section.querySelector<HTMLElement>(
      ':scope > .arc-panel-head :is(h2,.arc-stage-link)',
    );
    if (!heading?.textContent?.trim()) return [];
    const wrapper = section.closest<HTMLElement>('[data-pane-panel],#arc-production-release');
    const unit = wrapper?.querySelectorAll('.arc-surface').length === 1 ? wrapper : section;
    const label =
      unit.id === 'arc-event-log' && state.route === '/plan/'
        ? 'Event log'
        : heading.textContent.trim();
    const base =
      unit.id ||
      'arc-' +
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-$/, '');
    let id = `arc-${base.replace(/^arc-/, '')}` as PanelId;
    for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}` as PanelId;
    used.add(id);
    mountPanelGear(heading, id, label);
    return [{ id, label, section, unit }];
  });
}

function mountPanelGear(heading: HTMLElement, id: PanelId, label: string) {
  const group = document.createElement('div');
  group.className = 'arc-display-heading';
  heading.before(group);
  group.append(heading);
  group.insertAdjacentHTML('afterbegin', displayGear(id, `${label} display settings`));
}

function pageDefaults() {
  const defaults = defaultDisplay();
  if (state.route === '/plan/') return defaults;
  defaults.arranged = false;
  defaults.order = pagePanels.map(({ id }) => id);
  defaults.known = [...defaults.order];
  defaults.layout = host.querySelector('.arc-grid,.arc-stages') ? 2 : 1;
  defaults.layouts[2].regions = {};
  defaults.layouts[3].regions = {};
  for (const [index, { id, unit }] of pagePanels.entries()) {
    const overview = unit.closest('.arc-index');
    const slot = overview
      ? Number(Boolean(unit.closest('.arc-outcome-wrap,.arc-context-wrap')))
      : index % 2;
    defaults.layouts[2].regions[id] = slot;
    defaults.layouts[3].regions[id] = index % 3;
  }
  return defaults;
}

export function applyDisplay() {
  applyPalette(root, findColorScheme(colorSchemes.site)?.colors ?? {}, true);
  applyPalette(main, findColorScheme(display.scheme)?.colors ?? {});
  for (const { id, section } of pagePanels)
    applyPalette(section, findColorScheme(display.panelSchemes[id])?.colors ?? {});
}

function placeUnit({ id, unit, section }: DisplayPanel) {
  if (!unit.hasAttribute('data-pane-panel') || !unit.id) {
    if (!unit.id) unit.id = id;
    unit.setAttribute('data-pane-panel', '');
  }
  unit.classList.add('arc-display-panel');
  const expand = section.querySelector<HTMLElement>('[data-expand-pane]');
  if (expand?.dataset.expandPane !== undefined && expand.dataset.expandPane !== unit.id) {
    if (state.expandedPane === expand.dataset.expandPane) state.expandedPane = unit.id;
    expand.dataset.expandPane = unit.id;
    expand.setAttribute('aria-controls', unit.id);
  }
}

export function arrangeDisplay() {
  if (!display.arranged) return;
  grid ??= document.createElement('div');
  if (!grid.isConnected) host.insertBefore(grid, nativeGroups[0] ?? null);
  const focused = document.activeElement;
  const active = display.order.flatMap((id) => pagePanels.find((panel) => panel.id === id) ?? []);
  for (const panel of pagePanels) placeUnit(panel);
  if (!active.some(({ unit }) => unit.id === state.expandedPane)) state.expandedPane = null;
  grid.className =
    'arc-pane-workspace ' + (desktopDisplay.matches ? 'arc-display-layout' : 'arc-stack');
  grid.replaceChildren(arrangedUnits(active));
  updateWorkspace(grid);
  if (!active.length)
    grid.insertAdjacentHTML('beforeend', noData('Add panels from page settings.'));
  for (const group of nativeGroups)
    if (
      (group.parentElement === host || group.parentElement === main) &&
      !group.querySelector('.arc-surface')
    )
      group.hidden = true;
  if (desktopDisplay.matches) updateWidths(grid);
  icons();
  if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
}

function arrangedUnits(active: DisplayPanel[]) {
  const result = document.createDocumentFragment();
  const hidden = document.createElement('div');
  hidden.hidden = true;
  for (const panel of pagePanels) if (!active.includes(panel)) hidden.append(panel.unit);
  const count = desktopDisplay.matches ? display.layout : 1;
  for (let i = 0; i < count; i++) {
    const column = document.createElement('div');
    column.className =
      count === 1 && !desktopDisplay.matches ? 'arc-stack' : 'arc-stack arc-display-column';
    for (const { id, unit } of active)
      if (count === 1 || panelRegion(display, id) === i) column.append(unit);
    result.append(column);
    if (i + 1 < count) column.insertAdjacentHTML('afterend', splitter(i));
  }
  // Keep removed panels mounted so existing file edits and form values remain available.
  if (hidden.childElementCount) result.append(hidden);
  return result;
}

function splitter(index: number) {
  const label = `Resize columns ${index + 1} and ${index + 2}`;
  return `<div class="arc-column-divider"><button type="button" role="separator" class="arc-column-splitter" data-display-splitter="${index}"
    aria-orientation="vertical" aria-label="${label}" data-arc-tooltip="${label}"></button></div>`;
}

function updateWidths(grid: HTMLElement) {
  const stored = display.layouts[display.layout].widths;
  const widths = Array.from({ length: display.layout }, (_, i) => stored[i] ?? 1);
  grid.style.gridTemplateColumns = widths
    .map((width) => `minmax(var(--arc-display-column-min), ${width}fr)`)
    .join(' var(--gap) ');
  for (const [i, handle] of [...grid.querySelectorAll('[data-display-splitter]')].entries()) {
    const left = widths[i] ?? 1;
    const right = widths[i + 1] ?? 1;
    handle.setAttribute('aria-valuenow', String(Math.round((100 * left) / (left + right))));
  }
}

function resizeColumns(handle: HTMLElement) {
  const divider = handle.parentElement;
  const grid = divider?.parentElement;
  const left = divider?.previousElementSibling;
  const right = divider?.nextElementSibling;
  if (!grid || !left || !right) return;
  const widths = display.layouts[display.layout].widths;
  const index = Number(handle.dataset.displaySplitter);
  const totalWeight = (widths[index] ?? 1) + (widths[index + 1] ?? 1);
  const leftPixels = left.getBoundingClientRect().width;
  const totalPixels = leftPixels + right.getBoundingClientRect().width;
  const minimum = Number.parseFloat(getComputedStyle(left).minWidth);
  return (delta: number) => {
    const next = Math.max(minimum, Math.min(totalPixels - minimum, leftPixels + delta));
    widths[index] = (totalWeight * next) / totalPixels;
    widths[index + 1] = totalWeight - widths[index];
    updateWidths(grid);
  };
}

export function bindDisplayResize() {
  main.addEventListener('pointerdown', startResize);
  main.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-display-splitter]'))
      return;
    const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    resizeColumns(event.target)?.(direction * event.target.getBoundingClientRect().width);
    saveDisplay();
  });
}

function startResize(event: PointerEvent) {
  if (!(event.target instanceof Element) || event.button !== 0) return;
  const handle = event.target
    .closest('.arc-column-divider')
    ?.querySelector<HTMLElement>('[data-display-splitter]');
  if (!handle) return;
  const apply = resizeColumns(handle);
  if (!apply) return;
  handle.setPointerCapture(event.pointerId);
  const listeners = new AbortController();
  handle.addEventListener('pointermove', (move) => apply(move.clientX - event.clientX), {
    signal: listeners.signal,
  });
  handle.addEventListener(
    'lostpointercapture',
    () => {
      listeners.abort();
      saveDisplay();
    },
    { once: true },
  );
}
