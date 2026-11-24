import { colorFields } from './color-picker.ts';
import { colorSchemes } from './display-preferences.ts';
import type { Colors } from './display-preferences.ts';
import { escape } from './view.ts';

type Choice = { name: string; colors?: Colors };

export function schemeSelector(
  field: string,
  label: string,
  selected: string | undefined,
  fallback: Choice,
) {
  const active = colorSchemes.entries.some(({ id }) => id === selected) ? selected : '';
  const entries = [{ id: '', ...fallback }, ...colorSchemes.entries];
  const id = 'arc-scheme-' + escape(field);
  return `<div class="arc-scheme-field"><label for="${id}">${escape(label)}</label>
    <select id="${id}" class="arc-scheme-select" data-scheme-select="${escape(field)}">
    <button type="button"><selectedcontent></selectedcontent></button>
    ${entries
      .map(
        ({ id, name, colors }) => `<option value="${escape(id)}" ${active === id ? 'selected' : ''}>
      <span class="arc-scheme-option">${colors ? swatches(colors) : ''}<span>${escape(name)}</span></span></option>`,
      )
      .join('')}
  </select></div>`;
}

function swatches(colors: Colors) {
  return `<span class="arc-scheme-swatches" aria-hidden="true">${colorFields
    .map((field) => `<span style="--swatch:${escape(colors[field])}"></span>`)
    .join('')}</span>`;
}
