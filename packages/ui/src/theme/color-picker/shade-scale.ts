import { createElement as h } from 'react';

export function ShadeScale() {
  return h(
    'div',
    { className: 'arc-shade-scale', 'aria-hidden': true },
    h('span', null, 'Dark'),
    h('span', null, 'Light'),
  );
}
