import { useState } from 'react';
import { z } from 'zod';
import { useMedia } from '../hooks/use-media.js';

const color = z.string().regex(/^#[\da-f]{6}$/i);

const palette = z.object({ background: color, text: color, accent: color });

const scheme = z.object({ id: z.string(), name: z.string(), colors: palette });

const preferences = z.object({ selected: z.string(), schemes: z.array(scheme) });

export type Palette = z.infer<typeof palette>;

export type Scheme = z.infer<typeof scheme>;

export const colorFields = ['background', 'text', 'accent'] as const;

const storageKey = 'arcnexus.web.theme';

const defaults = {
  light: { background: '#edf4fc', text: '#142744', accent: '#195ac4' },
  dark: { background: '#0b182a', text: '#dceaff', accent: '#93bfff' },
};

function readTheme(): z.infer<typeof preferences> {
  try {
    return preferences.parse(JSON.parse(localStorage.getItem(storageKey) ?? 'null'));
  } catch {
    return { selected: '', schemes: [] };
  }
}

/** Store named schemes as per-browser UI preferences. */
export function useTheme() {
  const [value, setValue] = useState(readTheme);
  const dark = useMedia('(prefers-color-scheme: dark)');
  const defaultColors = dark ? defaults.dark : defaults.light;
  const current = value.schemes.find(({ id }) => id === value.selected);
  const commit = (next: typeof value) => {
    setValue(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };
  return {
    ...value,
    defaultColors,
    current,
    select: (selected: string) => commit({ ...value, selected }),
    save: (scheme: Scheme) => commit({ ...value, schemes: updatedSchemes(value.schemes, scheme) }),
  };
}

export type Theme = ReturnType<typeof useTheme>;

function updatedSchemes(schemes: readonly Scheme[], scheme: Scheme) {
  return schemes.some(({ id }) => id === scheme.id)
    ? schemes.map((current) => (current.id === scheme.id ? scheme : current))
    : [...schemes, scheme];
}
