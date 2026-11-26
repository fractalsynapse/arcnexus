import { createElement as h } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '../../controls/button.js';
import { initialShade } from './palette.js';
import type { PickerProps } from './palette.js';

type ShadeRowProps = PickerProps & { name: string; values: readonly string[] };

export function ShadeRow({ field, color, pick, name, values }: ShadeRowProps) {
  const initial = initialShade(color);
  return h(
    'div',
    { className: 'arc-shade-row' },
    h('small', null, name),
    h(
      'div',
      { className: 'arc-shades' },
      values.map((shade) =>
        h(Button, {
          key: shade,
          variant: 'plain',
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
