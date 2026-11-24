import { useId, useRef, createElement as h } from 'react';
import { ColorTrigger } from './color-trigger.js';
import { CustomColor } from './custom-color.js';
import { titles } from './palette.js';
import type { PickerProps } from './palette.js';
import { PickerHeader } from './picker-header.js';
import { ShadeRows } from './shade-rows.js';
import { ShadeScale } from './shade-scale.js';

/** Provide preset and custom choices in a single keyboard-accessible popover. */
export function ColorPicker({ field, color, pick }: PickerProps) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choose = (value: string) => {
    pick(value);
    popover.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  };
  return h(
    'div',
    null,
    h(ColorTrigger, { id, title: titles[field], color, control: trigger }),
    h(
      'div',
      {
        id,
        popover: 'auto',
        className: 'arc-color-picker',
        role: 'dialog',
        'aria-labelledby': id + '-title',
        ref: popover,
      },
      h(PickerHeader, { id, title: titles[field], field }),
      h(ShadeScale),
      h(ShadeRows, { field, color, pick: choose }),
      h(CustomColor, { key: color, color, pick: choose }),
    ),
  );
}
