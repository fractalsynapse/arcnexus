import { createElement as h } from 'react';
import { Swatch } from '../color-picker/swatch.js';
import { colorFields } from '../theme.js';
import type { Palette } from '../theme.js';

export function SchemeSwatches({ colors }: { colors: Palette }) {
  return h(
    'span',
    { className: 'arc-scheme-swatches', 'aria-hidden': true },
    colorFields.map((field) => h(Swatch, { key: field, color: colors[field] })),
  );
}
