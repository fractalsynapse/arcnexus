import { createElement as h, useState } from 'react';
import { Button } from '../controls/button.js';
import { SchemeSelect } from '../theme/schemes/scheme-select.js';
import type { Theme } from '../theme/theme-preferences.js';

interface AppearanceProps {
  theme: Theme;
  selected: string;
  close: () => void;
  save: (selected: string) => void;
}

/** Edit a display's named theme with the same scheme selector as the frame. */
export function DisplayAppearance({ theme, selected, close, save }: AppearanceProps) {
  const [draft, choose] = useState(selected);
  return h(
    'div',
    { className: 'arc-display-body' },
    h(SchemeSelect, {
      label: 'Color scheme',
      selected: draft,
      schemes: theme.schemes,
      defaultName: 'Site default',
      defaultColors: theme.current?.colors ?? theme.defaultColors,
      choose,
    }),
    h(
      'div',
      { className: 'arc-display-actions' },
      h(Button, { onClick: close }, 'Close'),
      h(Button, { onClick: () => save(draft) }, 'Save settings'),
    ),
  );
}
