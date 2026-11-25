import type { CSSProperties } from 'react';
import type { Palette, Scheme } from './theme-preferences.js';

/** Map a selected scheme to the visual tokens consumed by shell and display components. */
export function themeStyle(scheme: Scheme | undefined, base: Palette): CSSProperties {
  if (!scheme)
    return {
      '--ground': base.background,
      '--ink': base.text,
      '--link': base.accent,
    } as CSSProperties;
  return {
    colorScheme: paletteMode(scheme.colors.background),
    ...paletteVariables(scheme.colors),
  } as CSSProperties;
}

/** Apply the same theme tokens in React and the standalone mockup. */
export function paletteVariables({ background, text, accent }: Partial<Palette>) {
  return {
    '--ground': background,
    '--paper': background,
    '--ink': text,
    '--muted': text,
    '--link': accent,
    '--accent': accent,
    '--on-accent': accent && (paletteMode(accent) === 'dark' ? '#fff' : '#000'),
    '--quiet': (background || text) && 'color-mix(in srgb, var(--paper), var(--ink) 7%)',
    '--line': (background || text) && 'color-mix(in srgb, var(--paper), var(--ink) 27%)',
    '--tint': (background || accent) && 'color-mix(in srgb, var(--paper), var(--link) 17%)',
  };
}

export function paletteMode(background: string) {
  return contrast(background, '#ffffff') > contrast(background, '#000000') ? 'dark' : 'light';
}

/** Describe insufficient contrast within the same previewed combination. */
export function contrastWarning({ background, text, accent }: Palette) {
  const warnings = [];
  if (contrast(text, background) < 4.5) warnings.push('Text');
  if (contrast(accent, background) < 4.5) warnings.push('Accent');
  return warnings.length ? warnings.join(' and ') + ' may be hard to read on this background.' : '';
}

function contrast(left: string, right: string) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function luminance(hex: string) {
  const channel = (start: number) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
