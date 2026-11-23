import { dom, root } from './model.ts';
import { copyPanelPalette } from './display-colors.ts';

const tooltip = dom<HTMLElement>('.arc-tooltip');
let active: HTMLElement | null = null;

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
  positionTooltip();
}

function positionTooltip() {
  if (!active) return;
  const anchor = active.getBoundingClientRect();
  const { width, height } = tooltip.getBoundingClientRect();
  const gap = 6;
  const viewport = document.documentElement;
  const left = anchor.left + (anchor.width - width) / 2;
  const top = anchor.top >= height + 2 * gap ? anchor.top - height - gap : anchor.bottom + gap;
  tooltip.style.left = Math.max(gap, Math.min(left, viewport.clientWidth - width - gap)) + 'px';
  tooltip.style.top = Math.max(gap, Math.min(top, viewport.clientHeight - height - gap)) + 'px';
  tooltip.style.visibility =
    anchor.bottom <= 0 || anchor.top >= viewport.clientHeight ? 'hidden' : '';
}

export function dismissTooltip() {
  if (!active) return;
  active = null;
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
window.addEventListener('scroll', positionTooltip, true);
window.addEventListener('resize', positionTooltip);
