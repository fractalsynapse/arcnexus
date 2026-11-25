import { contrastWarning as colorWarning, paletteMode, paletteVariables } from '../../../packages/ui/src/theme/theme-colors.js';
import { colorFields, colorPicker } from './color-picker.ts';
import type { Colors, Palette } from './display-preferences.ts';

export { colorWarning };

const paletteTokens = [...Object.keys(paletteVariables({})), '--action-bg', '--action-text'];

export function applyPalette(element: HTMLElement, palette: Palette, site = false) {
  const { background = '', text = '', accent = '' } = palette;
  const customized = Boolean(background || text || accent);
  const variables = {
    ...paletteVariables(palette),
    '--action-bg': customized ? 'var(--tint)' : '',
    '--action-text': customized ? 'var(--link)' : '',
  };
  for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, value ?? '');
  if (site) document.documentElement.style.setProperty('--ground', background);
  element.style.colorScheme = background ? paletteMode(background) : '';
}

export function copyPanelPalette(from: HTMLElement, to: HTMLElement) {
  const panel = from.closest<HTMLElement>('.arc-surface,.arc-prose-dialog,.arc-inspector');
  const style = panel ? getComputedStyle(panel) : undefined;
  for (const token of paletteTokens)
    to.style.setProperty(token, style?.getPropertyValue(token) ?? '');
  to.style.colorScheme = style?.colorScheme ?? '';
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

export function colorFieldsView(palette: Colors) {
  return `<div class="arc-color-fields">${colorFields
    .map((field) => colorPicker(field, palette[field]))
    .join('')}</div><small role="status" data-contrast-warning>${colorWarning(palette)}</small>`;
}
