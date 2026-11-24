import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export interface DividerProps {
  column: number;
  widths: number[];
  setPreview: (widths?: number[]) => void;
  resize: (widths: number[]) => void;
}

export function useWidthDrag({ column, widths, setPreview, resize }: DividerProps) {
  const drag = useRef<{ origin: number; adjust: ReturnType<typeof measure> } | null>(null);
  const clear = () => {
    drag.current = null;
    setPreview();
  };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>) =>
    resizeWithKeys(event, widths, column, resize);
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        origin: event.clientX,
        adjust: measure(event.currentTarget, widths, column),
      };
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (drag.current) setPreview(drag.current.adjust(event.clientX - drag.current.origin));
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (!drag.current) return;
      resize(drag.current.adjust(event.clientX - drag.current.origin));
      clear();
    },
    onLostPointerCapture: clear,
    onKeyDown: keyboard,
  };
}

function resizeWithKeys(
  event: KeyboardEvent<HTMLButtonElement>,
  widths: number[],
  column: number,
  resize: DividerProps['resize'],
) {
  const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (!step) return;
  event.preventDefault();
  resize(measure(event.currentTarget, widths, column)(step * event.currentTarget.offsetWidth));
}

function measure(gutter: HTMLButtonElement, widths: readonly number[], index: number) {
  const left = gutter.previousElementSibling;
  const right = gutter.nextElementSibling;
  const current = left?.getBoundingClientRect().width ?? 0;
  const total = current + (right?.getBoundingClientRect().width ?? 0);
  const minimum = left ? Number.parseFloat(getComputedStyle(left).minWidth) : 0;
  const weight = (widths[index] ?? 1) + (widths[index + 1] ?? 1);
  return (delta: number) => {
    const next = [...widths];
    if (total <= 2 * minimum) return next;
    next[index] = weight * (Math.max(minimum, Math.min(total - minimum, current + delta)) / total);
    next[index + 1] = weight - next[index];
    return next;
  };
}
