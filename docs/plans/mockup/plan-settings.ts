import { colorFields, colorWarning, inheritedColors } from './display-colors.ts';
import { columns, display, saveDisplay } from './display-preferences.ts';
import type { PanelId, Preferences } from './display-preferences.ts';
import { main, root, state } from './model.ts';
import { applyPlanDisplay, planPanels } from './plan-layout.ts';
import { pageSettingsView, panelSettingsView } from './plan-settings-view.ts';
import type { SettingsTab } from './plan-settings-view.ts';
import { SortableLists } from './sortable.ts';
import { icons } from './view.ts';

type Session = { scope: 'page' | PanelId; draft: Preferences; tab: SettingsTab; scroll: number };
let active: Session | undefined;
let reordering: SortableLists | undefined;
let siteDefaults: ReturnType<typeof inheritedColors>;

export function bindPlanSettings(onSave: () => void) {
  siteDefaults = inheritedColors(root, true);
  main.addEventListener('click', (event) => {
    const control =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (state.route !== '/plan/' || !control) return;
    const { displayOpen, displayAction } = control.dataset;
    if (displayOpen) openSettings(displayOpen);
    else if (active && displayAction) handleSettingsAction(active, control, displayAction, onSave);
  });
  main.addEventListener('change', (event) => {
    if (active?.scope === 'page') changePageSettings(active, event.target);
  });
  main.addEventListener('input', (event) => {
    if (active) changeColor(active, event.target);
  });
}

function openSettings(scope: string) {
  const entry = planPanels.find((panel) => panel.id === scope);
  if (scope !== 'page' && !entry) return;
  if (active?.scope === scope) return;
  discardPlanSettings();
  active = {
    scope: entry?.id ?? 'page',
    draft: structuredClone(display),
    tab: 'active',
    scroll: scrollY,
  };
  if (active.scope === 'page') {
    reordering = new SortableLists(main, (_list, from, to) => {
      if (!active) return;
      reorderVisiblePanels(active.draft, from, to);
      refreshPlanSettings();
    });
    window.scrollTo(0, 0);
  }
  refreshPlanSettings();
  main
    .querySelector<HTMLElement>(
      active.scope === 'page' ? '[data-display-layout]:checked' : '[data-display-color]',
    )
    ?.focus({ preventScroll: true });
}

function reorderVisiblePanels(draft: Preferences, from: number, to: number) {
  const available = new Set(planPanels.map(({ id }) => id));
  const visible = draft.order.filter((id) => available.has(id));
  const [id] = visible.splice(from, 1);
  if (!id) return;
  visible.splice(to, 0, id);
  draft.order = draft.order.map((entry) =>
    available.has(entry) ? (visible.shift() ?? entry) : entry,
  );
}

export function refreshPlanSettings() {
  if (!active || state.route !== '/plan/') return;
  const { scope, draft } = active;
  if (scope === 'page') renderPageForm(active);
  else {
    const section = main.querySelector(`#${scope} .arc-surface`);
    const colors = { ...inheritedColors(root), ...draft.panels[scope] };
    section?.setAttribute('data-display-editing', '');
    section?.querySelector('[data-panel-display-settings]')?.remove();
    section?.insertAdjacentHTML('beforeend', panelSettingsView(colors));
  }
  icons();
}

function renderPageForm(session: Session) {
  const editor = main.querySelector<HTMLElement>('#arc-plan-settings');
  const dashboard = main.querySelector<HTMLElement>('#arc-plan-dashboard');
  if (!editor || !dashboard) return;
  session.tab = editor.querySelector('[aria-selected="true"]')?.id.endsWith('available')
    ? 'available'
    : editor.innerHTML
      ? 'active'
      : session.tab;
  dashboard.hidden = true;
  editor.hidden = false;
  editor.innerHTML = pageSettingsView(session.draft, planPanels, session.tab, {
    ...siteDefaults,
    ...session.draft.site,
  });
}

function changePageSettings(session: Session, target: EventTarget | null) {
  if (target instanceof HTMLInputElement && target.hasAttribute('data-display-layout')) {
    const layout = columns.find((count) => String(count) === target.value);
    if (!layout) return;
    session.draft.layout = layout;
    refreshPlanSettings();
    main
      .querySelector<HTMLElement>('[data-display-layout]:checked')
      ?.focus({ preventScroll: true });
  } else if (target instanceof HTMLSelectElement) {
    const panel = planPanels.find((entry) => entry.id === target.dataset.displayRegion);
    if (panel) session.draft.layouts[session.draft.layout].regions[panel.id] = Number(target.value);
  }
}

function changeColor(session: Session, target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement) || !/^#[a-f\d]{6}$/i.test(target.value)) return;
  const field = colorFields.find((name) => name === target.dataset.displayColor);
  if (!field) return;
  const palette =
    session.scope === 'page' ? session.draft.site : (session.draft.panels[session.scope] ??= {});
  palette[field] = target.value;
  const colors = session.scope === 'page' ? siteDefaults : inheritedColors(root);
  const warning = main.querySelector('[data-contrast-warning]');
  if (warning) warning.textContent = colorWarning({ ...colors, ...palette });
}

function handleSettingsAction(
  session: Session,
  control: HTMLElement,
  action: string,
  onSave: () => void,
) {
  if (action === 'save' || action === 'close')
    return finishSettings(session, action === 'save', onSave);
  if (action === 'reset-colors') {
    if (session.scope === 'page') session.draft.site = {};
    else delete session.draft.panels[session.scope];
    refreshPlanSettings();
    main
      .querySelector<HTMLElement>('[data-display-action="reset-colors"]')
      ?.focus({ preventScroll: true });
    return;
  }
  const id = control.closest<HTMLElement>('[data-display-entry]')?.dataset.displayEntry;
  const entry = planPanels.find((panel) => panel.id === id);
  if (!entry) return;
  if (action === 'remove')
    session.draft.order = session.draft.order.filter((panel) => panel !== entry.id);
  else if (action === 'add' && !session.draft.order.includes(entry.id))
    session.draft.order.push(entry.id);
  refreshPlanSettings();
  main
    .querySelector<HTMLElement>('#arc-plan-settings [aria-selected="true"]')
    ?.focus({ preventScroll: true });
}

function finishSettings({ scope, draft, scroll }: Session, save: boolean, onSave: () => void) {
  discardPlanSettings();
  if (save && scope === 'page') {
    if (!draft.order.some((id) => id === state.expandedPane)) state.expandedPane = null;
    saveDisplay(draft);
    onSave();
  } else if (save && scope !== 'page') {
    display.panels[scope] = draft.panels[scope];
    saveDisplay();
    applyPlanDisplay();
  }
  main.querySelector<HTMLElement>(`[data-display-open="${scope}"]`)?.focus({ preventScroll: true });
  window.scrollTo(0, scroll);
}

export function discardPlanSettings() {
  if (!active) return;
  const editor = main.querySelector<HTMLElement>('#arc-plan-settings');
  const dashboard = main.querySelector<HTMLElement>('#arc-plan-dashboard');
  if (editor) {
    editor.hidden = true;
    editor.replaceChildren();
  }
  if (dashboard) dashboard.hidden = false;
  main.querySelector('[data-display-editing]')?.removeAttribute('data-display-editing');
  main.querySelector('[data-panel-display-settings]')?.remove();
  reordering?.dispose();
  reordering = undefined;
  active = undefined;
}
