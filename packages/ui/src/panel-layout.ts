import { createElement as h, Fragment, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { orderedDisplays, panelColumn, type PagePreferences } from './page-preferences.js';
import type { DisplayRegistration } from './types.js';

interface LayoutProps {
  panels: readonly DisplayRegistration[];
  preferences: PagePreferences;
  resize: (widths: number[]) => void;
}

/** Arrange registered displays into desktop columns and one ordered mobile stack. */
export function PanelLayout({ panels, preferences, resize }: LayoutProps) {
  const [preview, setPreview] = useState<number[]>();
  const active = orderedDisplays(panels, preferences.order).filter(
    ({ id }) => !preferences.hidden.includes(id),
  );
  if (!active.length) return null;
  const widths =
    preview ??
    Array.from({ length: preferences.columns }, (_, index) => preferences.widths[index] ?? 1);
  const style = {
    '--arc-columns': widths
      .map((width) => 'minmax(var(--arc-column-min), ' + width + 'fr)')
      .join(' var(--gap) '),
  } as CSSProperties;
  return h(
    'div',
    { className: 'arc-panel-layout', style, 'data-resizing': preview ? '' : undefined },
    widths.map((_, column) =>
      h(
        Fragment,
        { key: column },
        h(DisplayColumn, { active, preferences, column }),
        column + 1 < widths.length && h(ColumnDivider, { column, widths, setPreview, resize }),
      ),
    ),
  );
}

function DisplayColumn({
  active,
  preferences,
  column,
}: {
  active: readonly DisplayRegistration[];
  preferences: PagePreferences;
  column: number;
}) {
  return h(
    'div',
    { className: 'arc-layout-column' },
    active.map((panel, order) =>
      panelColumn(panel, preferences) === column
        ? h(Display, { key: panel.id, panel, order })
        : null,
    ),
  );
}

function Display({ panel, order }: { panel: DisplayRegistration; order: number }) {
  return h(
    'section',
    { className: 'arc-surface arc-display', style: { order } },
    h('h2', null, panel.label),
    panel.content,
  );
}

interface DividerProps {
  column: number;
  widths: number[];
  setPreview: (widths?: number[]) => void;
  resize: (widths: number[]) => void;
}

function ColumnDivider(props: DividerProps) {
  const { column, widths } = props;
  const handlers = useWidthDrag(props);
  const left = widths[column] ?? 1;
  const right = widths[column + 1] ?? 1;
  return h(
    'button',
    {
      type: 'button',
      className: 'arc-column-divider',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Resize columns ' + (column + 1) + ' and ' + (column + 2),
      'aria-valuenow': Math.round((100 * left) / (left + right)),
      ...handlers,
    },
    h('span', { 'aria-hidden': true }),
  );
}

function useWidthDrag({ column, widths, setPreview, resize }: DividerProps) {
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
