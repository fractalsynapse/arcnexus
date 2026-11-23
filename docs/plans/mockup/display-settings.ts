import { bindColorPicker, colorFields } from './color-picker.ts';
import { colorWarning, inheritedColors } from './display-colors.ts';
import { columns, display, saveDisplay } from './display-preferences.ts';
import type { PanelId, Preferences } from './display-preferences.ts';
import { main, root } from './model.ts';
import { applyDisplay, arrangeDisplay, displayPageTitle, pagePanels } from './display-layout.ts';
import { pageSettingsView, panelSettingsView } from './display-settings-view.ts';
import type { SettingsTab } from './display-settings-view.ts';
import { SortableLists } from './sortable.ts';
import { icons } from './view.ts';

type Session = { scope: 'page' | PanelId; draft: Preferences; tab: SettingsTab; scroll: number };
let active: Session | undefined;
let reordering: SortableLists | undefined;
let siteDefaults: ReturnType<typeof inheritedColors>;

export function bindDisplaySettings() {
  siteDefaults = inheritedColors(root, true);
  bindColorPicker(main, (field, value) => {
    if (active) changeColor(active, field, value);
  });
  main.addEventListener('click', (event) => {
    const control =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!control) return;
    const { displayOpen, displayAction } = control.dataset;
    if (displayOpen) openSettings(displayOpen);
    else if (active && displayAction) handleSettingsAction(active, control, displayAction);
  });
  main.addEventListener('change', (event) => {
    if (active?.scope === 'page') changePageSettings(active, event.target);
  });
}

function openSettings(scope: string) {
  const entry = pagePanels.find((panel) => panel.id === scope);
  if (scope !== 'page' && !entry) return;
  if (active?.scope === scope) return;
  discardDisplaySettings();
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
      refreshDisplaySettings();
    });
    window.scrollTo(0, 0);
  }
  refreshDisplaySettings();
  main
    .querySelector<HTMLElement>(
      active.scope === 'page' ? '[data-display-layout]:checked' : '.arc-color-trigger',
    )
    ?.focus({ preventScroll: true });
}

function reorderVisiblePanels(draft: Preferences, from: number, to: number) {
  const available = new Set(pagePanels.map(({ id }) => id));
  const visible = draft.order.filter((id) => available.has(id));
  const [id] = visible.splice(from, 1);
  if (!id) return;
  draft.arranged = true;
  visible.splice(to, 0, id);
  draft.order = draft.order.map((entry) =>
    available.has(entry) ? (visible.shift() ?? entry) : entry,
  );
}

export function refreshDisplaySettings() {
  if (!active) return;
  const { scope, draft } = active;
  if (scope === 'page') renderPageForm(active);
  else {
    const section = pagePanels.find(({ id }) => id === scope)?.section;
    const colors = { ...inheritedColors(root), ...draft.panels[scope] };
    section?.setAttribute('data-display-editing', '');
    section?.querySelector('[data-panel-display-settings]')?.remove();
    section?.insertAdjacentHTML('beforeend', panelSettingsView(colors));
  }
  icons();
}

function renderPageForm(session: Session) {
  const editor = main.querySelector<HTMLElement>('#arc-page-settings');
  if (!editor) return;
  session.tab = editor.querySelector('[aria-selected="true"]')?.id.endsWith('available')
    ? 'available'
    : editor.innerHTML
      ? 'active'
      : session.tab;
  main.setAttribute('data-page-settings', '');
  editor.hidden = false;
  editor.innerHTML = pageSettingsView(displayPageTitle, session.draft, pagePanels, session.tab, {
    ...siteDefaults,
    ...session.draft.site,
  });
}

function changePageSettings(session: Session, target: EventTarget | null) {
  if (target instanceof HTMLInputElement && target.hasAttribute('data-display-layout')) {
    const layout = columns.find((count) => String(count) === target.value);
    if (!layout) return;
    session.draft.layout = layout;
    session.draft.arranged = true;
    refreshDisplaySettings();
    main
      .querySelector<HTMLElement>('[data-display-layout]:checked')
      ?.focus({ preventScroll: true });
  } else if (target instanceof HTMLSelectElement) {
    const panel = pagePanels.find((entry) => entry.id === target.dataset.displayRegion);
    if (!panel) return;
    session.draft.layouts[session.draft.layout].regions[panel.id] = Number(target.value);
    session.draft.arranged = true;
  }
}

function changeColor(session: Session, fieldName: string, color: string) {
  const field = colorFields.find((name) => name === fieldName);
  if (!field) return;
  const palette =
    session.scope === 'page' ? session.draft.site : (session.draft.panels[session.scope] ??= {});
  palette[field] = color;
  const colors = session.scope === 'page' ? siteDefaults : inheritedColors(root);
  const warning = main.querySelector('[data-contrast-warning]');
  if (warning) warning.textContent = colorWarning({ ...colors, ...palette });
}

function handleSettingsAction(session: Session, control: HTMLElement, action: string) {
  if (action === 'save' || action === 'close') return finishSettings(session, action === 'save');
  if (action === 'reset-colors') {
    if (session.scope === 'page') session.draft.site = {};
    else delete session.draft.panels[session.scope];
    refreshDisplaySettings();
    main
      .querySelector<HTMLElement>('[data-display-action="reset-colors"]')
      ?.focus({ preventScroll: true });
    return;
  }
  const id = control.closest<HTMLElement>('[data-display-entry]')?.dataset.displayEntry;
  const entry = pagePanels.find((panel) => panel.id === id);
  if (!entry) return;
  if (action === 'remove')
    session.draft.order = session.draft.order.filter((panel) => panel !== entry.id);
  else if (action === 'add' && !session.draft.order.includes(entry.id))
    session.draft.order.push(entry.id);
  session.draft.arranged = true;
  refreshDisplaySettings();
  main
    .querySelector<HTMLElement>('#arc-page-settings [aria-selected="true"]')
    ?.focus({ preventScroll: true });
}

function finishSettings({ scope, draft, scroll }: Session, save: boolean) {
  discardDisplaySettings();
  if (save && scope === 'page') {
    saveDisplay(draft);
    applyDisplay();
    arrangeDisplay();
  } else if (save && scope !== 'page') {
    display.panels[scope] = draft.panels[scope];
    saveDisplay();
    applyDisplay();
  }
  main.querySelector<HTMLElement>(`[data-display-open="${scope}"]`)?.focus({ preventScroll: true });
  window.scrollTo(0, scroll);
}

export function discardDisplaySettings() {
  if (!active) return;
  const editor = main.querySelector<HTMLElement>('#arc-page-settings');
  if (editor) {
    editor.hidden = true;
    editor.replaceChildren();
  }
  main.removeAttribute('data-page-settings');
  main.querySelector('[data-display-editing]')?.removeAttribute('data-display-editing');
  main.querySelector('[data-panel-display-settings]')?.remove();
  reordering?.dispose();
  reordering = undefined;
  active = undefined;
}
