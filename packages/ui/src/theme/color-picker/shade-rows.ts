import { createElement as h } from 'react';
import type { KeyboardEvent } from 'react';
import { families } from './palette.js';
import type { PickerProps } from './palette.js';
import { ShadeRow } from './shade-row.js';

/** Keep the swatch grid one Tab stop and allow arrows to move within it. */
export function ShadeRows(props: PickerProps) {
  return h(
    'div',
    { className: 'arc-shade-grid', onKeyDown: moveShade },
    Object.entries(families).map(([name, values]) =>
      h(ShadeRow, { ...props, key: name, name, values }),
    ),
  );
}

function moveShade(event: KeyboardEvent<HTMLDivElement>) {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const count = families.Neutral.length;
  const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -count, ArrowDown: count }[event.key];
  if (!move) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
  const next = buttons[buttons.indexOf(event.target) + move];
  event.preventDefault();
  if (!next) return;
  event.target.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}
