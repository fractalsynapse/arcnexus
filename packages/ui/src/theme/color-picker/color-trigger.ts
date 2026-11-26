import { createElement as h } from 'react';
import type { RefObject } from 'react';
import { Button } from '../../controls/button.js';
import { Icon } from '../../controls/icon.js';
import { Swatch } from './swatch.js';

export function ColorTrigger({
  id,
  title,
  color,
  control,
}: {
  id: string;
  title: string;
  color: string;
  control: RefObject<HTMLButtonElement | null>;
}) {
  return h(
    Button,
    {
      className: 'arc-color-trigger',
      popoverTarget: id,
      ref: control,
      'aria-label': title,
      'aria-haspopup': 'dialog',
    },
    h(Swatch, { color }),
    h('span', null, title, h('code', null, color)),
    h(Icon, { name: 'down' }),
  );
}
