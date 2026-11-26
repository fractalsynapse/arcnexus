import { useState, createElement as h, Fragment } from 'react';
import type { CSSProperties } from 'react';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { orderedDisplays } from '../page/page-preferences.js';
import type { PagePreferences } from '../page/page-preferences.js';
import { ColumnDivider } from './column-divider.js';
import { DisplayRegion } from './display-region.js';
import { panelLayoutFor, panelRegionsFor } from './presets/index.js';
import { displayFocus } from '../../displays/display-focus.js';

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
    panelLayoutFor(preferences.columns).columnLabels.map(
      (_, index) => preferences.widths[index] ?? 1,
    );
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
      resizing: !!preview,
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

function LayoutRegions({
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
    panelRegionsFor(panelLayoutFor(preferences.columns)).map(({ id }) =>
      h(
        Fragment,
        { key: id },
        h(DisplayRegion, { active, preferences, region: id, workspace }),
        typeof id === 'number' &&
          id + 1 < widths.length &&
          h(ColumnDivider, { column: id, widths, setPreview, resize }),
      ),
    ),
  );
}

type RegionProps = Parameters<typeof LayoutRegions>[0] & {
  resizing: boolean;
  focused?: string;
};

function PanelRegions({ resizing, focused, ...regions }: RegionProps) {
  return h(
    'div',
    {
      className: 'arc-panel-layout',
      style: columnStyle(regions.widths),
      'data-resizing': resizing ? '' : undefined,
      'data-focus': focused ? '' : undefined,
    },
    h(LayoutRegions, regions),
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
