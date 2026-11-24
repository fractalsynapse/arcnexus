import { dismissTooltip } from './tooltip.ts';

type Row = {
  list: HTMLElement;
  key: string;
  item: HTMLElement;
  handle: HTMLButtonElement;
  rows: HTMLElement[];
  index: number;
};

type Drag = Row & {
  pointer: number;
  height: number;
  offset: number;
  x: number;
  y: number;
  gap: HTMLElement;
  remaining: HTMLElement[];
  destination?: number;
};

/** Reorder a list through a dedicated grip while leaving its inputs interactive. */
export class SortableLists {
  private readonly listeners = new AbortController();
  private drag?: Drag;
  private frame?: number;

  /** Connect pointer and keyboard actions to one list container's reorder callback. */
  constructor(
    private readonly container: HTMLElement,
    private readonly reorder: (list: string, from: number, to: number) => void,
  ) {
    const { signal } = this.listeners;
    container.addEventListener('pointerdown', (event) => this.start(event), { signal });
    container.addEventListener('pointermove', (event) => this.track(event), { signal });
    container.addEventListener('pointerup', (event) => this.drop(event), { signal });
    container.addEventListener('pointercancel', (event) => this.cancelPointer(event), { signal });
    container.addEventListener('lostpointercapture', (event) => this.cancelPointer(event), {
      signal,
    });
    container.addEventListener('keydown', (event) => this.keyboard(event), { signal });
    window.addEventListener('scroll', () => this.place(), { signal, capture: true });
  }

  /** Return the current row to its original position and clear the insertion gap. */
  cancel() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    drag.gap.remove();
    delete drag.item.dataset.sortDragging;
    drag.item.style.removeProperty('top');
    if (drag.handle.hasPointerCapture(drag.pointer))
      drag.handle.releasePointerCapture(drag.pointer);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }

  /** Disconnect interactions when the editor leaves the page. */
  dispose() {
    this.cancel();
    this.listeners.abort();
  }

  /** Lift the pressed row from layout and reserve its original space. */
  private start(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || this.drag) return;
    const row = sortRow(event.target);
    if (!row || row.rows.length < 2) return;
    event.preventDefault();
    row.handle.focus({ preventScroll: true });
    dismissTooltip();
    row.handle.setPointerCapture(event.pointerId);
    const bounds = row.item.getBoundingClientRect();
    const gap = document.createElement('div');
    gap.className = 'arc-sort-gap';
    gap.style.blockSize = `${bounds.height}px`;
    gap.setAttribute('aria-hidden', 'true');
    row.item.before(gap);
    row.item.dataset.sortDragging = '';
    this.drag = {
      ...row,
      pointer: event.pointerId,
      height: bounds.height,
      offset: event.clientY - bounds.top,
      x: event.clientX,
      y: event.clientY,
      gap,
      remaining: row.rows.filter((item) => item !== row.item),
      destination: row.index,
    };
    this.place();
  }

  /** Follow the captured pointer and start scrolling when it approaches an edge. */
  private track(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    this.place();
    if (this.frame === undefined) this.frame = requestAnimationFrame(() => this.scroll());
  }

  /** Open only the gap under the pointer and keep the lifted row under the grip. */
  private place() {
    const drag = this.drag;
    if (!drag) return;
    const bounds = drag.list.getBoundingClientRect();
    drag.item.style.top = `${drag.y - bounds.top - drag.offset}px`;
    if (
      drag.x < bounds.left ||
      drag.x > bounds.right ||
      drag.y < bounds.top - drag.offset ||
      drag.y > bounds.bottom + drag.height - drag.offset
    ) {
      drag.gap.remove();
      drag.destination = undefined;
      return;
    }
    if (drag.gap.isConnected) {
      const gap = drag.gap.getBoundingClientRect();
      if (drag.y >= gap.top && drag.y <= gap.bottom) return;
    }
    const before = drag.remaining.findIndex((item) => {
      const bounds = item.getBoundingClientRect();
      return drag.y < bounds.top + bounds.height / 2;
    });
    const next = before < 0 ? drag.remaining.length : before;
    if (next === drag.destination && drag.gap.isConnected) return;
    drag.list.insertBefore(drag.gap, drag.remaining[next] ?? null);
    drag.destination = next;
  }

  /** Allow a held row to reach list entries beyond the viewport. */
  private scroll() {
    this.frame = undefined;
    const drag = this.drag;
    if (!drag || drag.destination === undefined) return;
    const height = document.documentElement.clientHeight;
    const edge = Math.min(height / 2, drag.height);
    const amount = drag.y < edge ? drag.y - edge : Math.max(0, drag.y - (height - edge));
    if (!amount) return;
    const previous = window.scrollY;
    window.scrollBy({ top: amount / 6, behavior: 'instant' });
    if (window.scrollY !== previous) this.frame = requestAnimationFrame(() => this.scroll());
  }

  /** Commit the visible insertion point on release and restore the grip's focus. */
  private drop(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    const destination = drag.destination;
    this.cancel();
    if (destination !== undefined) this.move(drag, destination);
  }

  /** Treat interruption and lost capture as a cancellation. */
  private cancelPointer(event: PointerEvent) {
    if (event.pointerId === this.drag?.pointer) this.cancel();
  }

  /** Support accessible reordering and allow Escape to cancel a pointer drag. */
  private keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.drag) {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (this.drag || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const row = sortRow(event.target);
    if (!row) return;
    const destinations: Record<string, number> = {
      ArrowUp: row.index - 1,
      ArrowDown: row.index + 1,
      Home: 0,
      End: row.rows.length - 1,
    };
    const destination = destinations[event.key];
    if (typeof destination !== 'number') return;
    event.preventDefault();
    this.move(row, destination);
  }

  /** Update the ordered data once, then focus and announce the row's new position. */
  private move(row: Row, destination: number) {
    if (destination < 0 || destination >= row.rows.length || destination === row.index) return;
    this.reorder(row.key, row.index, destination);
    const list = this.container.querySelector(`[data-sortable-list="${CSS.escape(row.key)}"]`);
    const item = list?.querySelectorAll(':scope > [data-sort-row]')[destination];
    const grips = item?.querySelectorAll<HTMLButtonElement>('[data-sort-handle]') ?? [];
    Array.from(grips)
      .find((handle) => handle.closest('[data-sort-row]') === item)
      ?.focus();
    const status = this.container.querySelector('[data-sort-status]');
    if (status)
      status.textContent = `Moved item to position ${destination + 1} of ${row.rows.length}.`;
  }
}

function sortRow(target: EventTarget | null): Row | undefined {
  if (!(target instanceof Element)) return;
  const handle = target.closest<HTMLButtonElement>('button[data-sort-handle]');
  const item = handle?.closest<HTMLElement>('[data-sort-row]');
  const list = item?.parentElement;
  const key = list?.dataset.sortableList;
  if (!handle || !item || !list || !key) return;
  const rows = [...list.querySelectorAll<HTMLElement>(':scope > [data-sort-row]')];
  return { list, key, item, handle, rows, index: rows.indexOf(item) };
}
