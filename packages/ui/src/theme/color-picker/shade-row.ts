import { createElement as h } from 'react';
import type { CSSProperties } from 'react';
import { shades } from './palette.js';
import type { PickerProps } from './palette.js';

type ShadeRowProps = PickerProps & { name: string; values: readonly string[] };

export function ShadeRow({ field, color, pick, name, values }: ShadeRowProps) {
  const initial = shades.includes(color) ? color : shades[0];
  return h(
    'div',
    { className: 'arc-shade-row' },
    h('small', null, name),
    h(
      'div',
      { className: 'arc-shades' },
      values.map((shade) =>
        h('button', {
          key: shade,
          type: 'button',
          className: 'arc-shade',
          'aria-label': name + ' ' + shade + ' for ' + field,
          'aria-pressed': shade === color,
          tabIndex: shade === initial ? 0 : -1,
          autoFocus: shade === initial,
          style: { '--swatch': shade } as CSSProperties,
          onClick: () => pick(shade),
        }),
      ),
    ),
  );
}
