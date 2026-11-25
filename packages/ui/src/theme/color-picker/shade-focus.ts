import { families } from './palette.js';

/** Move the single Tab stop within the shared grid of color families. */
export function moveShadeFocus(
  event: Pick<KeyboardEvent, 'target' | 'key' | 'preventDefault'>,
  grid: Element | null,
) {
  if (!(event.target instanceof HTMLButtonElement) || !grid) return;
  const count = families.Neutral.length;
  const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -count, ArrowDown: count }[event.key];
  if (!move) return;
  const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>('.arc-shade'));
  const next = buttons[buttons.indexOf(event.target) + move];
  event.preventDefault();
  if (!next) return;
  event.target.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}
