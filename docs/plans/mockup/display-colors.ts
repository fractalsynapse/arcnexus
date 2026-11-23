import type { Palette } from './display-preferences.ts';
import { escape } from './view.ts';

export const colorFields = ['background', 'text', 'accent'] as const;
export type ColorField = (typeof colorFields)[number];
type Colors = Required<Palette>;

export function applyPalette(element: HTMLElement, palette: Palette, site = false) {
  const { background = '', text = '', accent = '' } = palette;
  const variables = {
    '--paper': background,
    '--ink': text,
    '--muted': text,
    '--accent': accent,
    '--link': accent,
  };
  for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, value);
  if (site) {
    element.style.setProperty('--ground', background);
    document.documentElement.style.setProperty('--ground', background);
  }
  const onAccent = accent
    ? contrast(accent, '#ffffff') > contrast(accent, '#000000')
      ? '#ffffff'
      : '#000000'
    : '';
  element.style.setProperty('--on-accent', onAccent);
}

export function inheritedColors(parent: HTMLElement, site = false): Colors {
  const probe = document.createElement('span');
  probe.hidden = true;
  parent.append(probe);
  const read = (name: string) => {
    probe.style.color = 'var(' + name + ')';
    const rgb = getComputedStyle(probe).color.match(/\d+/g)?.slice(0, 3) ?? [];
    return '#' + rgb.map((channel) => Number(channel).toString(16).padStart(2, '0')).join('');
  };
  const colors = {
    background: read(site ? '--ground' : '--paper'),
    text: read('--ink'),
    accent: read('--link'),
  };
  probe.remove();
  return colors;
}

export function colorFieldsView(palette: Colors, reset: string) {
  return `<div class="arc-color-fields">${colorFields
    .map(
      (field) =>
        `<label>${field[0]?.toUpperCase()}${field.slice(1)} <input type="color" data-display-color="${field}" value="${escape(palette[field])}"></label>`,
    )
    .join(
      '',
    )}</div><div class="arc-row"><button type="button" class="arc-button" data-display-action="reset-colors">${reset}</button>
    <small role="status" data-contrast-warning>${colorWarning(palette)}</small></div>`;
}

export function colorWarning({ background, text, accent }: Colors) {
  const warnings = [];
  // WCAG's normal-text reference informs the warning. Color choices remain available.
  if (contrast(text, background) < 4.5) warnings.push('Text');
  if (contrast(accent, background) < 4.5) warnings.push('Accent');
  return warnings.length ? `${warnings.join(' and ')} may be hard to read on this background.` : '';
}

function contrast(left: string, right: string) {
  const l = luminance(left);
  const r = luminance(right);
  return (Math.max(l, r) + 0.05) / (Math.min(l, r) + 0.05);
}

function luminance(hex: string) {
  const linear = (start: number) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}
