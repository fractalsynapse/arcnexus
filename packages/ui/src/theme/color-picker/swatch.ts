import { createElement as h } from 'react';
import type { CSSProperties } from 'react';

/** Render any palette color with the common border and swatch shape. */
export function Swatch({ color }: { color: string }) {
  return h('span', {
    className: 'arc-swatch',
    style: { '--swatch': color } as CSSProperties,
    'aria-hidden': true,
  });
}
