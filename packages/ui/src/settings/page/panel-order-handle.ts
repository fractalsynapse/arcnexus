import { createElement as h } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Button } from '../../controls/button.js';

interface OrderHandleProps {
  index: number;
  label: string;
  move: (index: number) => void;
}

export function PanelOrderHandle({ index, label, move }: OrderHandleProps) {
  const key = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    move(index + step);
  };
  return h(
    Button,
    {
      className: 'arc-order-handle',
      'aria-label': 'Reorder ' + label,
      'aria-description': 'Drag or use up and down arrow keys',
      onKeyDown: key,
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => dropPanel(event, move),
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) =>
        event.currentTarget.setPointerCapture(event.pointerId),
    },
    '⠿',
  );
}

function dropPanel(event: PointerEvent<HTMLButtonElement>, move: (index: number) => void) {
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-panel-order]');
  if (row?.dataset.panelOrder !== undefined) move(Number(row.dataset.panelOrder));
}
