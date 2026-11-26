/** Keep a visible tooltip adjacent to its control while the viewport moves. */
export function trackTooltipPosition(anchor: HTMLElement, tooltip: HTMLElement) {
  const position = () => {
    const rect = anchor.getBoundingClientRect();
    const view = document.documentElement;
    const { width, height } = tooltip.getBoundingClientRect();
    const gap = 6;
    const below = rect.bottom + gap;
    tooltip.style.left =
      Math.max(gap, Math.min(rect.right - width, view.clientWidth - width - gap)) + 'px';
    tooltip.style.top =
      (below + height + gap <= view.clientHeight ? below : Math.max(gap, rect.top - height - gap)) +
      'px';
    tooltip.style.visibility = rect.bottom < 0 || rect.top >= view.clientHeight ? 'hidden' : '';
  };
  position();
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  return () => {
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
  };
}
