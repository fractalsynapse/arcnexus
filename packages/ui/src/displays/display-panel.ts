import { createElement as h, useContext, useId, useState } from 'react';
import type { DisplayRegistration } from '../registry/workspace.js';
import { themeScope } from '../theme/theme-scope.js';
import { themeStyle } from '../theme/theme-colors.js';
import { useUiPreferences } from '../preferences/browser.js';
import { DisplayAppearance } from './display-appearance.js';
import { displayFocus } from './display-focus.js';
import { DisplayHeading } from './display-heading.js';

interface PanelProps {
  panel: DisplayRegistration;
  order: number;
  workspace: string;
}

/** Supply the shared display shell to every registered panel. */
export function DisplayPanel({ panel, order, workspace }: PanelProps) {
  const { title, theme, appearance, expanded, palette, header } = useDisplayPanel(workspace, panel);
  return h(
    'section',
    {
      className: 'arc-surface arc-display',
      style: { ...palette, order },
      'aria-labelledby': title,
      'data-focused': expanded ? '' : undefined,
    },
    h(DisplayHeading, header),
    theme && appearance.open && h(DisplayAppearance, { theme, ...appearance }),
    h('div', { className: 'arc-display-body', hidden: appearance.open }, panel.content),
  );
}

function useAppearance(workspace: string, panel: string) {
  const { entries, save } = useUiPreferences();
  const value = entries.find(
    (entry) => entry.kind === 'display' && entry.workspace === workspace && entry.panel === panel,
  );
  const [open, setOpen] = useState(false);
  return {
    open,
    selected: value?.kind === 'display' ? value.selected : '',
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    save: async (selected: string) => {
      if (await save({ kind: 'display', workspace, panel, selected })) setOpen(false);
    },
  };
}

function useDisplayPanel(workspace: string, panel: DisplayRegistration) {
  const title = useId();
  const theme = useContext(themeScope);
  const focus = useContext(displayFocus);
  const appearance = useAppearance(workspace, panel.id);
  const expanded = focus.focused === panel.id;
  const scheme = theme?.schemes.find(({ id }) => id === appearance.selected);
  const palette = scheme && theme ? themeStyle(scheme, theme.defaultColors) : undefined;
  const header = {
    title,
    label: panel.label,
    settings: appearance.open,
    expanded,
    toggleSettings: appearance.toggle,
    toggleFocus: focus.toggle && (() => focus.toggle?.(panel.id)),
  };
  return { title, theme, appearance, expanded, palette, header };
}
