import { useState, createElement as h, Fragment } from 'react';
import type { CSSProperties } from 'react';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { orderedDisplays } from '../page/page-preferences.js';
import type { PagePreferences } from '../page/page-preferences.js';
import { ColumnDivider } from './column-divider.js';
import { DisplayColumn } from './display-column.js';
import { panelLayoutFor } from './presets/index.js';

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
    panelLayoutFor(preferences.columns).regions.map((_, index) => preferences.widths[index] ?? 1);
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
