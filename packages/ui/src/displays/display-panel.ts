import { createElement as h, useContext, useId, useState } from 'react';
import type { DisplayRegistration } from '../registry/workspace.js';
import { themeScope } from '../theme/theme-scope.js';
import { themeStyle } from '../theme/theme-colors.js';
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
  const { title, theme, appearance, expanded, palette, header, minimized } = useDisplayPanel(
    workspace,
    panel,
  );
  return h(
    'section',
    {
      className: 'arc-surface arc-display',
      style: { ...palette, order },
      'aria-labelledby': title,
      'data-focused': expanded ? '' : undefined,
      'data-full-width': panel.fullWidth ? '' : undefined,
    },
    h(DisplayHeading, header),
    theme && appearance.open && h(DisplayAppearance, { theme, ...appearance }),
    !minimized &&
      h('div', { className: 'arc-display-body', hidden: appearance.open }, panel.content),
  );
}

function useAppearance(workspace: string, panel: string) {
  const key = 'arcnexus.web.panel:' + JSON.stringify([workspace, panel]);
  const [open, setOpen] = useState(false);
  const [selected, select] = useState(() => {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  });
  return {
    open,
    selected,
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    save: (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {}
      select(next);
      setOpen(false);
    },
  };
}

function panelControls({
  panel,
  appearance,
  focus,
  expanded,
  minimized,
  minimize,
}: {
  panel: string;
  appearance: ReturnType<typeof useAppearance>;
  focus: import('./display-focus.js').DisplayFocus;
  expanded: boolean;
  minimized: boolean;
  minimize: (minimized: boolean) => void;
}) {
  return {
    toggleSettings: appearance.toggle,
    toggleFocus:
      focus.toggle &&
      (() => {
        minimize(false);
        focus.toggle?.(panel);
      }),
    toggleMinimized: () => {
      if (expanded) focus.toggle?.(panel);
      minimize(!minimized);
    },
  };
}

function useDisplayPanel(workspace: string, panel: DisplayRegistration) {
  const title = useId();
  const theme = useContext(themeScope);
  const focus = useContext(displayFocus);
  const appearance = useAppearance(workspace, panel.id);
  const [minimized, minimize] = useState(false);
  const expanded = focus.focused === panel.id;
  const scheme = theme?.schemes.find(({ id }) => id === appearance.selected);
  const palette = scheme && theme ? themeStyle(scheme, theme.defaultColors) : undefined;
  const controls = panelControls({
    panel: panel.id,
    appearance,
    focus,
    expanded,
    minimized,
    minimize,
  });
  const header = {
    title,
    label: panel.label,
    settings: appearance.open,
    minimized,
    expanded,
    ...controls,
  };
  return { title, theme, appearance, expanded, palette, header, minimized };
}
