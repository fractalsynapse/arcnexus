import { useMedia } from '../hooks/use-media.js';
import { useUiPreferences } from '../preferences/browser.js';
import type { Scheme } from '../preferences/schema.js';

export type { Palette, Scheme } from '../preferences/schema.js';

export const colorFields = ['background', 'text', 'accent'] as const;

const defaults = {
  light: { background: '#edf4fc', text: '#142744', accent: '#195ac4' },
  dark: { background: '#0b182a', text: '#dceaff', accent: '#93bfff' },
};

/** Derive the current palette from the operator's shared scheme library. */
export function useTheme() {
  const { entries, save } = useUiPreferences();
  const site = entries.find(({ kind }) => kind === 'site');
  const selected = site?.kind === 'site' ? site.selected : '';
  const schemes = entries.flatMap((entry) => (entry.kind === 'scheme' ? [entry.scheme] : []));
  const dark = useMedia('(prefers-color-scheme: dark)');
  const defaultColors = dark ? defaults.dark : defaults.light;
  return {
    schemes,
    selected,
    defaultColors,
    current: schemes.find(({ id }) => id === selected),
    select: (selected: string) => save({ kind: 'site', selected }),
    save: (scheme: Scheme) => save({ kind: 'scheme', scheme }),
  };
}

export type Theme = ReturnType<typeof useTheme>;
