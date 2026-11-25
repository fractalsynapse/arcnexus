import { useRef, createElement as h, useState, useEffect, useId } from 'react';
import type { ReactElement, ReactNode, PointerEvent, FocusEvent, KeyboardEvent } from 'react';
import { trackTooltipPosition } from './tooltip-position.js';

export interface TooltipProps {
  label: string;
  children?: ReactNode;
  focusAnchor?: boolean;
}

/** Keep compact hints above sticky navigation and clipped panels. */
export function Tooltip({ label, children, focusAnchor }: TooltipProps): ReactElement {
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const id = useId();
  const interaction = useTooltipInteraction(anchor, tooltip, label, focusAnchor);
  return h(
    'span',
    {
      ref: anchor,
      className: 'arc-icon-wrap',
      tabIndex: focusAnchor ? 0 : undefined,
      'aria-describedby': focusAnchor ? id : undefined,
      ...interaction,
    },
    children,
    h(
      'span',
      {
        id,
        ref: tooltip,
        popover: 'manual',
        className: 'arc-tooltip',
        role: focusAnchor ? 'tooltip' : undefined,
        'aria-hidden': !focusAnchor,
      },
      label,
    ),
  );
}

function useTooltipInteraction(
  anchor: { current: HTMLElement | null },
  tooltip: { current: HTMLElement | null },
  label: string,
  focusAnchor?: boolean,
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
    onPointerUp: (event: PointerEvent<HTMLSpanElement>) => {
      if (!focusAnchor || event.pointerType !== 'touch') return;
      event.currentTarget.focus({ preventScroll: true });
      setKeyboard(true);
    },
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
