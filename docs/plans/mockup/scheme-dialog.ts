import { bindColorPicker, colorFields } from './color-picker.ts';
import { colorFieldsView, colorWarning } from './display-colors.ts';
import { applyDisplay } from './display-layout.ts';
import {
  colorSchemes,
  defaultSchemeColors,
  findColorScheme,
  saveColorScheme,
  setSiteScheme,
} from './display-preferences.ts';
import type { ColorScheme } from './display-preferences.ts';
import { refreshDisplaySettings } from './display-settings.ts';
import { showInspector } from './inspector.ts';
import { dom, inspector } from './model.ts';
import { schemeSelector } from './scheme-selector.ts';
import { escape } from './view.ts';

let draft: ColorScheme;

export function openColorSchemes(opener: HTMLButtonElement) {
  showInspector(opener, 'Color schemes', () => {
    inspector.tool = null;
    draft = editScheme('');
    return schemeDialog();
  });
}

function editScheme(id: string): ColorScheme {
  const saved = findColorScheme(id);
  if (saved) return structuredClone(saved);
  const colors = findColorScheme(colorSchemes.site)?.colors ?? defaultSchemeColors();
  return { id: '', name: '', colors: { ...colors } };
}

function schemeDialog() {
  return `<div class="arc-scheme-manager">
    ${schemeSelector('site', 'Site background and default scheme', colorSchemes.site, { name: 'ArcNexus default', colors: defaultSchemeColors() })}
    <form class="arc-scheme-editor" data-scheme-editor>
      ${schemeSelector('edit', 'Scheme to edit', draft.id, { name: 'New scheme' })}
      <label>Scheme name<input name="scheme-name" value="${escape(draft.name)}" required></label>
      ${colorFieldsView(draft.colors)}
      <div class="arc-row arc-scheme-save"><span role="status" data-scheme-feedback></span>
        <button type="submit" class="arc-button solid">Save scheme</button></div>
    </form></div>`;
}

export function bindColorSchemes() {
  const content = dom('.arc-inspector-content');
  bindColorPicker(content, (key, value) => {
    const field = colorFields.find((entry) => entry === key);
    const warning = content.querySelector('[data-contrast-warning]');
    if (!field || !warning) return;
    draft.colors[field] = value;
    warning.textContent = colorWarning(draft.colors);
  });
  content.addEventListener('change', (event) => changeSchemeSelection(content, event.target));
  content.addEventListener('input', ({ target }) => {
    if (target instanceof HTMLInputElement && target.name === 'scheme-name')
      target.setCustomValidity('');
  });
  content.addEventListener('submit', (event) => {
    if (
      !(event.target instanceof HTMLFormElement) ||
      !event.target.hasAttribute('data-scheme-editor')
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    saveDraft(content, event.target);
  });
}

function changeSchemeSelection(content: HTMLElement, target: EventTarget | null) {
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.schemeSelect === 'site') {
    setSiteScheme(target.value);
    applyDisplay();
    refreshDisplaySettings();
  } else if (target.dataset.schemeSelect === 'edit') {
    draft = editScheme(target.value);
    content.innerHTML = schemeDialog();
    content.querySelector<HTMLElement>('[name="scheme-name"]')?.focus({ preventScroll: true });
  }
}

function saveDraft(content: HTMLElement, form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('[name="scheme-name"]');
  if (!input) return;
  const name = input.value.trim();
  const duplicate = colorSchemes.entries.some(
    (scheme) => scheme.id !== draft.id && scheme.name.toLowerCase() === name.toLowerCase(),
  );
  input.setCustomValidity(
    !name ? 'Enter a scheme name.' : duplicate ? 'This scheme name is already in use.' : '',
  );
  if (!input.reportValidity()) return;
  draft = { ...draft, id: draft.id || crypto.randomUUID(), name };
  saveColorScheme(draft);
  draft = structuredClone(draft);
  applyDisplay();
  refreshDisplaySettings();
  content.innerHTML = schemeDialog();
  const feedback = content.querySelector('[data-scheme-feedback]');
  if (feedback) feedback.textContent = `Saved ${name}.`;
  content.querySelector<HTMLElement>('[type="submit"]')?.focus({ preventScroll: true });
}
