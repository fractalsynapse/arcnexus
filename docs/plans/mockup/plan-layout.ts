import { applyPalette } from './display-colors.ts';
import { display, panelRegion, saveDisplay } from './display-preferences.ts';
import type { PanelId } from './display-preferences.ts';
import { main, root, state } from './model.ts';
import { paneView, workspace } from './panels.ts';
import type { Pane } from './panels.ts';
import { escape, noData } from './view.ts';

export type PlanPane = Pane & { id: PanelId };
export const desktopPlan = matchMedia('(min-width: 900px)');
export let planPanels: readonly PlanPane[] = [];

export function displayGear(scope: string, label: string) {
  return `<button type="button" class="arc-link arc-display-gear" data-display-open="${escape(scope)}"
    aria-label="${escape(label)}" data-arc-tooltip="${escape(label)}"><span aria-hidden="true">⚙</span></button>`;
}

export function planLayout(registry: PlanPane[]) {
  planPanels = registry;
  const visible = display.order.flatMap((id) => registry.find((panel) => panel.id === id) ?? []);
  const selected = visible.find((panel) => panel.id === state.expandedPane)?.id;
  const cards = (list: PlanPane[]) =>
    list
      .map((panel) =>
        paneView(
          panel,
          selected,
          'arc-display-panel',
          displayGear(panel.id, `${panel.label} display settings`),
        ),
      )
      .join('');
  if (!visible.length) return noData('Add panels from Plan page settings.');
  if (!desktopPlan.matches) return workspace('arc-stack', selected, cards(visible));
  const columns = Array.from(
    { length: display.layout },
    (_, i) =>
      `<div class="arc-stack arc-plan-column">${cards(visible.filter((panel) => panelRegion(display, panel.id) === i))}</div>`,
  );
  return workspace(
    'arc-plan-layout',
    selected,
    columns.map((column, i) => column + (i + 1 < columns.length ? splitter(i) : '')).join(''),
  );
}

function splitter(index: number) {
  const label = `Resize columns ${index + 1} and ${index + 2}`;
  return `<div class="arc-column-divider"><button type="button" role="separator" class="arc-column-splitter" data-plan-splitter="${index}"
    aria-orientation="vertical" aria-label="${label}" data-arc-tooltip="${label}"></button></div>`;
}

export function applyPlanDisplay() {
  applyPalette(root, display.site, true);
  for (const panel of planPanels) {
    const element = main.querySelector<HTMLElement>(`#${panel.id}.arc-display-panel`);
    if (element) applyPalette(element, display.panels[panel.id] ?? {});
  }
  const grid = main.querySelector<HTMLElement>('.arc-plan-layout');
  if (grid) updateWidths(grid);
}

function updateWidths(grid: HTMLElement) {
  const stored = display.layouts[display.layout].widths;
  const widths = Array.from({ length: display.layout }, (_, i) => stored[i] ?? 1);
  grid.style.gridTemplateColumns = widths
    .map((width) => `minmax(var(--arc-plan-column-min), ${width}fr)`)
    .join(' var(--gap) ');
  for (const [i, handle] of [...grid.querySelectorAll('[data-plan-splitter]')].entries()) {
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
  const index = Number(handle.dataset.planSplitter);
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

export function bindPlanResize() {
  main.addEventListener('pointerdown', startResize);
  main.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-plan-splitter]'))
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
    ?.querySelector<HTMLElement>('[data-plan-splitter]');
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
