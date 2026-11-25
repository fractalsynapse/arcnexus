import { useState, createElement as h, Fragment } from 'react';
import type { CSSProperties } from 'react';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { orderedDisplays } from '../page/page-preferences.js';
import type { PagePreferences } from '../page/page-preferences.js';
import { ColumnDivider } from './column-divider.js';
import { DisplayColumn } from './display-column.js';
import { panelLayoutFor } from './presets/index.js';
import { displayFocus } from '../../displays/display-focus.js';
import { DisplayPanel } from '../../displays/display-panel.js';

interface LayoutProps {
  panels: readonly DisplayRegistration[];
  preferences: PagePreferences;
  resize: (widths: number[]) => void;
  workspace: string;
}

/** Arrange registered displays into desktop columns and one ordered mobile stack. */
export function PanelLayout({ panels, preferences, resize, workspace }: LayoutProps) {
  const [preview, setPreview] = useState<number[]>();
  const [focus, setFocus] = useState<string>();
  const active = orderedDisplays(panels, preferences.order).filter(
    ({ id }) => !preferences.hidden.includes(id),
  );
  if (!active.length) return null;
  const focused = active.some(({ id }) => id === focus) ? focus : undefined;
  const widths =
    preview ??
    panelLayoutFor(preferences.columns).regions.map((_, index) => preferences.widths[index] ?? 1);
  const style = columnStyle(widths);
  return h(
    displayFocus.Provider,
    { value: focusControls(focused, setFocus) },
    h(PanelRegions, {
      active,
      preferences,
      workspace,
      widths,
      setPreview,
      resize,
      style,
      preview,
      focused,
    }),
  );
}

function columnStyle(widths: number[]): CSSProperties {
  return {
    '--arc-columns': widths
      .map((width) => 'minmax(var(--arc-column-min), ' + width + 'fr)')
      .join(' var(--gap) '),
  } as CSSProperties;
}

function LayoutColumns({
  active,
  preferences,
  workspace,
  widths,
  setPreview,
  resize,
}: Pick<LayoutProps, 'preferences' | 'workspace' | 'resize'> & {
  active: DisplayRegistration[];
  widths: number[];
  setPreview: (widths: number[] | undefined) => void;
}) {
  return h(
    Fragment,
    null,
    widths.map((_, column) =>
      h(
        Fragment,
        { key: column },
        h(DisplayColumn, { active, preferences, column, workspace }),
        column + 1 < widths.length && h(ColumnDivider, { column, widths, setPreview, resize }),
      ),
    ),
  );
}

type RegionProps = Parameters<typeof LayoutColumns>[0] & {
  style: CSSProperties;
  preview?: number[];
  focused?: string;
};

function PanelRegions({ style, preview, focused, ...columns }: RegionProps) {
  const { active, workspace } = columns;
  return h(
    'div',
    {
      className: 'arc-panel-layout',
      style,
      'data-resizing': preview ? '' : undefined,
      'data-focus': focused ? '' : undefined,
    },
    active.map(
      (panel, order) =>
        panel.fullWidth && h(DisplayPanel, { key: panel.id, panel, order, workspace }),
    ),
    h(LayoutColumns, columns),
  );
}

function focusControls(
  focused: string | undefined,
  setFocus: React.Dispatch<React.SetStateAction<string | undefined>>,
) {
  return {
    focused,
    toggle: (id: string) => setFocus((previous) => (previous === id ? undefined : id)),
  };
}
