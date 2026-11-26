/** Resolve the next tab in visual reading order, wrapping the arrow keys. */
export function tabDestination(key: string, current: number, count: number, vertical = false) {
  if (current < 0) return;
  return {
    [vertical ? 'ArrowUp' : 'ArrowLeft']: (current - 1 + count) % count,
    [vertical ? 'ArrowDown' : 'ArrowRight']: (current + 1) % count,
    Home: 0,
    End: count - 1,
  }[key];
}
