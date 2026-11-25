import { useRef, createElement as h, useState, useEffect } from 'react';
import type { ReactNode, PointerEvent, FocusEvent, KeyboardEvent } from 'react';
import { trackTooltipPosition } from './tooltip-position.js';

/** Keep compact hints above sticky navigation and clipped panels. */
export function Tooltip({ label, children }: { label: string; children?: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const interaction = useTooltipInteraction(anchor, tooltip, label);
  return h(
    'span',
    {
      ref: anchor,
      className: 'arc-icon-wrap',
      ...interaction,
    },
    children,
    h(
      'span',
      { ref: tooltip, popover: 'manual', className: 'arc-tooltip', 'aria-hidden': true },
      label,
    ),
  );
}

function useTooltipInteraction(
  anchor: { current: HTMLElement | null },
  tooltip: { current: HTMLElement | null },
  label: string,
) {
  const [pointer, setPointer] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (!anchor.current || !tooltip.current || !(pointer || keyboard)) return;
    return positionTooltip(anchor.current, tooltip.current);
  }, [anchor, tooltip, pointer, keyboard, label]);
  return {
    onPointerEnter: (event: PointerEvent) => setPointer(event.pointerType !== 'touch'),
    onPointerLeave: () => setPointer(false),
    onFocus: (event: FocusEvent) => setKeyboard(event.target.matches(':focus-visible')),
    onBlur: () => setKeyboard(false),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPointer(false);
      setKeyboard(false);
    },
  };
}

function positionTooltip(anchor: HTMLElement, tooltip: HTMLElement) {
  tooltip.showPopover();
  const stop = trackTooltipPosition(anchor, tooltip);
  return () => {
    stop();
    tooltip.hidePopover();
  };
}
