import { trackTooltipPosition } from '../../../packages/ui/src/controls/tooltip-position.js';
import { dom, root } from './model.ts';
import { copyPanelPalette } from './display-colors.ts';

const tooltip = dom<HTMLElement>('.arc-tooltip');
let active: HTMLElement | null = null;
let stopPlacement: (() => void) | undefined;

function trigger(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-arc-tooltip]') : null;
}

function showTooltip(control: HTMLElement | null) {
  const message = control?.dataset.arcTooltip;
  if (!control || !message || control === active) return;
  active = control;
  copyPanelPalette(control, tooltip);
  tooltip.textContent = message;
  tooltip.showPopover();
  stopPlacement?.();
  stopPlacement = trackTooltipPosition(control, tooltip);
}

export function dismissTooltip() {
  if (!active) return;
  active = null;
  stopPlacement?.();
  stopPlacement = undefined;
  tooltip.hidePopover();
}

function leaveTooltip(event: PointerEvent | FocusEvent) {
  if (trigger(event.target) === active && trigger(event.relatedTarget) !== active) dismissTooltip();
}

root.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'touch') showTooltip(trigger(event.target));
});
root.addEventListener('pointerout', leaveTooltip);
root.addEventListener('focusin', (event) => showTooltip(trigger(event.target)));
root.addEventListener('focusout', leaveTooltip);
root.addEventListener('click', dismissTooltip);
root.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') dismissTooltip();
});
