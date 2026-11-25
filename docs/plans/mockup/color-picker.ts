import { families as colorFamilies, initialShade, normalizeHex, titles } from '../../../packages/ui/src/theme/color-picker/palette.js';
import { moveShadeFocus } from '../../../packages/ui/src/theme/color-picker/shade-focus.js';
import { colorFields } from '../../../packages/ui/src/theme/theme-preferences.js';
import { escape } from './view.ts';

export { colorFields };
type ColorField = (typeof colorFields)[number];

type OnPick = (field: string, color: string) => void;

export function colorPicker(field: ColorField, selected: string) {
  const label = titles[field];
  const id = 'arc-picker-' + field;
  return `<div class="arc-color-field" data-color-field="${field}">
    <button type="button" class="arc-button arc-color-trigger" popovertarget="${id}" aria-haspopup="dialog"
      aria-labelledby="${id}-label" aria-describedby="${id}-value">
      <span class="arc-color-sample" style="--swatch:${escape(selected)}" aria-hidden="true"></span>
      <span><span id="${id}-label">${label}</span><code id="${id}-value" data-color-value>${escape(selected)}</code></span>
      <span aria-hidden="true">▾</span>
    </button>
    <div popover="auto" class="arc-color-picker" id="${id}" role="dialog" aria-labelledby="${id}-title">
      <div class="arc-color-picker-head"><h3 id="${id}-title">${label}</h3>
        <button type="button" class="arc-link" aria-label="Close ${field} picker" popovertarget="${id}" popovertargetaction="hide">×</button>
      </div>
      <div class="arc-shade-scale" aria-hidden="true"><span>Dark</span><span>Light</span></div>
      <div class="arc-shade-palette">${shadeRows(field, selected.toLowerCase())}</div>
      <div class="arc-color-custom">
        <label>Custom hex color <input type="text" data-color-hex value="${escape(selected)}"
          form="" pattern="#?[0-9a-fA-F]{6}" required title="Enter a six-digit hex color such as #23415e." spellcheck="false" autocomplete="off"></label>
        <button type="button" class="arc-button" data-color-use>Use color</button>
      </div>
    </div>
  </div>`;
}

function shadeRows(field: ColorField, selected: string) {
  const focused = initialShade(selected);
  return Object.entries(colorFamilies)
    .map(
      ([
        family,
        shades,
      ]) => `<div class="arc-shade-family"><small>${family}</small><div class="arc-shades">
      ${shades
        .map(
          (shade) => `<button type="button" class="arc-shade" style="--swatch:${shade}"
        data-color-shade="${shade}" aria-label="${family} ${shade} for ${field}" aria-pressed="${shade === selected}"
        ${shade === focused ? 'tabindex="0" autofocus' : 'tabindex="-1"'}></button>`,
        )
        .join('')}
      </div></div>`,
    )
    .join('');
}

export function bindColorPicker(container: HTMLElement, onPick: OnPick) {
  container.addEventListener('click', (event) => {
    const control =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-color-shade],[data-color-use]')
        : null;
    if (control) chooseColor(control, onPick);
  });
  container.addEventListener('keydown', (event) => {
    const control = event.target;
    if (!(control instanceof HTMLElement)) return;
    if (event.key === 'Enter' && control.hasAttribute('data-color-hex')) {
      event.preventDefault();
      chooseColor(control, onPick);
    } else if (control.hasAttribute('data-color-shade')) {
      moveShadeFocus(event, control.closest('.arc-shade-palette'));
    }
  });
}

function chooseColor(control: HTMLElement, onPick: OnPick) {
  const field = control.closest<HTMLElement>('[data-color-field]');
  const input = field?.querySelector<HTMLInputElement>('[data-color-hex]');
  const fieldName = field?.dataset.colorField;
  if (!field || !fieldName || !input) return;
  if (!control.dataset.colorShade && !input.reportValidity()) return;
  const color = normalizeHex(control.dataset.colorShade ?? input.value);
  input.value = color;
  onPick(fieldName, color);
  const sample = field.querySelector<HTMLElement>('.arc-color-sample');
  sample?.style.setProperty('--swatch', color);
  const value = field.querySelector('[data-color-value]');
  if (value) value.textContent = color;
  const focused = initialShade(color);
  for (const option of field.querySelectorAll<HTMLButtonElement>('[data-color-shade]')) {
    option.setAttribute('aria-pressed', String(option.dataset.colorShade === color));
    option.toggleAttribute('autofocus', option.dataset.colorShade === focused);
    option.tabIndex = option.dataset.colorShade === focused ? 0 : -1;
  }
  field.querySelector<HTMLElement>('[popover]')?.hidePopover();
  field.querySelector<HTMLElement>('[popovertarget]')?.focus({ preventScroll: true });
}
