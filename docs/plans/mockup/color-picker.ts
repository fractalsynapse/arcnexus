import { escape } from './view.ts';

export const colorFields = ['background', 'text', 'accent'] as const;
type ColorField = (typeof colorFields)[number];

const colorFamilies = {
  Neutral: ['#090a0c', '#22252b', '#383d45', '#66707d', '#aeb8c4', '#e2e7ee', '#ffffff'],
  Red: ['#230b12', '#3d101b', '#651b27', '#ae3748', '#e66f7f', '#ffccd1', '#fff0f1'],
  Orange: ['#271308', '#46200d', '#713411', '#bd5a24', '#f08c55', '#ffd2af', '#fff2e8'],
  Amber: ['#211707', '#3b290d', '#5b4011', '#9b6c17', '#e3ae3e', '#ffe5a0', '#fff7db'],
  Olive: ['#181b09', '#2c320e', '#465017', '#67792a', '#a6b95a', '#e1ebae', '#f5f8e7'],
  Green: ['#0c1c13', '#122e20', '#1b4a30', '#32764b', '#6cb987', '#c1eccd', '#edf9ee'],
  Teal: ['#091c1b', '#102e2d', '#174845', '#26776f', '#5fb6ad', '#b5e9e1', '#e8faf6'],
  Cyan: ['#091b22', '#102d3b', '#18465b', '#257390', '#5cb5ce', '#bdebf4', '#ecfaff'],
  Blue: ['#0b1529', '#132341', '#1d365f', '#305b99', '#6595e0', '#bfd7fc', '#edf4ff'],
  Indigo: ['#14132a', '#232044', '#363067', '#534798', '#8c80db', '#d6ceff', '#f2efff'],
  Violet: ['#1d1028', '#321b44', '#4d2a64', '#7c4899', '#ae78ce', '#ebcdf7', '#f9effd'],
  Pink: ['#240f20', '#3e1835', '#60274f', '#9b437d', '#d576ac', '#f6cbe5', '#fff0f8'],
};
const shadesPerFamily = colorFamilies.Neutral.length;
const shadeValues = new Set(Object.values(colorFamilies).flat());
type OnPick = (field: string, color: string) => void;

export function colorPicker(field: ColorField, selected: string) {
  const label = field[0]?.toUpperCase() + field.slice(1);
  const id = 'arc-picker-' + field;
  return `<div class="arc-color-field" data-color-field="${field}">
    <button type="button" class="arc-button arc-color-trigger" popovertarget="${id}" aria-haspopup="dialog"
      aria-labelledby="${id}-label" aria-describedby="${id}-value">
      <span class="arc-color-sample" style="--swatch:${escape(selected)}" aria-hidden="true"></span>
      <span><span id="${id}-label">${label} color</span><code id="${id}-value" data-color-value>${escape(selected)}</code></span>
      <span aria-hidden="true">▾</span>
    </button>
    <div popover="auto" class="arc-color-picker" id="${id}" role="dialog" aria-labelledby="${id}-title">
      <div class="arc-color-picker-head"><h3 id="${id}-title">${label} color</h3>
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
  const focused = shadeValues.has(selected) ? selected : colorFamilies.Neutral[0];
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
      moveShadeFocus(control, event);
    }
  });
}

function chooseColor(control: HTMLElement, onPick: OnPick) {
  const field = control.closest<HTMLElement>('[data-color-field]');
  const input = field?.querySelector<HTMLInputElement>('[data-color-hex]');
  const fieldName = field?.dataset.colorField;
  if (!field || !fieldName || !input) return;
  if (!control.dataset.colorShade && !input.reportValidity()) return;
  const color = '#' + (control.dataset.colorShade ?? input.value).replace(/^#/, '').toLowerCase();
  input.value = color;
  onPick(fieldName, color);
  const sample = field.querySelector<HTMLElement>('.arc-color-sample');
  sample?.style.setProperty('--swatch', color);
  const value = field.querySelector('[data-color-value]');
  if (value) value.textContent = color;
  const focused = shadeValues.has(color) ? color : colorFamilies.Neutral[0];
  for (const option of field.querySelectorAll<HTMLButtonElement>('[data-color-shade]')) {
    option.setAttribute('aria-pressed', String(option.dataset.colorShade === color));
    option.toggleAttribute('autofocus', option.dataset.colorShade === focused);
    option.tabIndex = option.dataset.colorShade === focused ? 0 : -1;
  }
  field.querySelector<HTMLElement>('[popover]')?.hidePopover();
  field.querySelector<HTMLElement>('[popovertarget]')?.focus({ preventScroll: true });
}

function moveShadeFocus(control: HTMLElement, event: KeyboardEvent) {
  const offset = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -shadesPerFamily,
    ArrowDown: shadesPerFamily,
  }[event.key];
  if (!offset) return;
  const palette = control.closest('.arc-shade-palette');
  const buttons = [...(palette?.querySelectorAll<HTMLElement>('[data-color-shade]') ?? [])];
  const next = buttons[buttons.indexOf(control) + offset];
  event.preventDefault();
  if (!next) return;
  control.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}
