import type { Palette } from './display-preferences.ts';
import { escape } from './view.ts';

export const colorFields = ['background', 'text', 'accent'] as const;
export type ColorField = (typeof colorFields)[number];
type Colors = Required<Palette>;

const colorFamilies = {
  Neutral: ['#101114', '#22252b', '#383d45', '#66707d', '#aeb8c4', '#eef2f7'],
  Red: ['#230b12', '#3d101b', '#651b27', '#ae3748', '#e66f7f', '#ffccd1'],
  Orange: ['#271308', '#46200d', '#713411', '#bd5a24', '#f08c55', '#ffd2af'],
  Amber: ['#211707', '#3b290d', '#5b4011', '#9b6c17', '#e3ae3e', '#ffe5a0'],
  Olive: ['#181b09', '#2c320e', '#465017', '#67792a', '#a6b95a', '#e1ebae'],
  Green: ['#0c1c13', '#122e20', '#1b4a30', '#32764b', '#6cb987', '#c1eccd'],
  Teal: ['#091c1b', '#102e2d', '#174845', '#26776f', '#5fb6ad', '#b5e9e1'],
  Cyan: ['#091b22', '#102d3b', '#18465b', '#257390', '#5cb5ce', '#bdebf4'],
  Blue: ['#0b1529', '#132341', '#1d365f', '#305b99', '#6595e0', '#bfd7fc'],
  Indigo: ['#14132a', '#232044', '#363067', '#534798', '#8c80db', '#d6ceff'],
  Violet: ['#1d1028', '#321b44', '#4d2a64', '#7c4899', '#ae78ce', '#ebcdf7'],
  Pink: ['#240f20', '#3e1835', '#60274f', '#9b437d', '#d576ac', '#f6cbe5'],
};

const paletteTokens = [
  '--ground',
  '--paper',
  '--ink',
  '--muted',
  '--accent',
  '--link',
  '--on-accent',
  '--quiet',
  '--tint',
  '--line',
  '--action-bg',
  '--action-text',
];

export function applyPalette(element: HTMLElement, palette: Palette, site = false) {
  const { background = '', text = '', accent = '' } = palette;
  const customized = Boolean(background || text || accent);
  const variables = {
    '--ground': background,
    '--paper': background,
    '--ink': text,
    '--muted': text,
    '--accent': accent,
    '--link': accent,
    '--quiet': background || text ? 'color-mix(in srgb, var(--paper), var(--ink) 7%)' : '',
    '--line': background || text ? 'color-mix(in srgb, var(--paper), var(--ink) 27%)' : '',
    '--tint': background || accent ? 'color-mix(in srgb, var(--paper), var(--link) 17%)' : '',
    '--action-bg': customized ? 'var(--tint)' : '',
    '--action-text': customized ? 'var(--link)' : '',
  };
  for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, value);
  if (site) document.documentElement.style.setProperty('--ground', background);
  element.style.colorScheme = background ? (hasLightText(background) ? 'dark' : 'light') : '';
  const onAccent = accent ? (hasLightText(accent) ? '#ffffff' : '#000000') : '';
  element.style.setProperty('--on-accent', onAccent);
}

export function copyPanelPalette(from: HTMLElement, to: HTMLElement) {
  const panel = from.closest<HTMLElement>('.arc-surface,.arc-prose-dialog,.arc-inspector');
  const style = panel ? getComputedStyle(panel) : undefined;
  for (const token of paletteTokens)
    to.style.setProperty(token, style?.getPropertyValue(token) ?? '');
  to.style.colorScheme = style?.colorScheme ?? '';
}

function hasLightText(background: string) {
  return contrast(background, '#ffffff') > contrast(background, '#000000');
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
    .map((field) => colorPicker(field, palette[field]))
    .join(
      '',
    )}</div><div class="arc-row"><button type="button" class="arc-button" data-display-action="reset-colors">${reset}</button>
    <small role="status" data-contrast-warning>${colorWarning(palette)}</small></div>`;
}

function colorPicker(field: ColorField, selected: string) {
  const label = field[0]?.toUpperCase() + field.slice(1);
  const choices = Object.entries(colorFamilies).map(
    ([family, shades]) =>
      `<div class="arc-shade-family"><small>${family}</small><div class="arc-shades">${shades
        .map(
          (shade) =>
            `<button type="button" class="arc-shade" style="--swatch:${shade}" data-display-swatch="${shade}"
        aria-label="${family} ${shade} for ${field}" aria-pressed="${shade.toLowerCase() === selected.toLowerCase()}" data-arc-tooltip="${family} ${shade}"></button>`,
        )
        .join('')}</div></div>`,
  );
  return `<div class="arc-color-field"><label>${label} <input type="color" data-display-color="${field}" value="${escape(selected)}"></label>
    <details><summary>Browse ${field} shades</summary><div class="arc-shade-palette">${choices.join('')}</div></details></div>`;
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
