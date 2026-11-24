import { useState, createElement as h } from 'react';
import { Button } from '../../controls/button.js';
import type { PagePreferences } from '../../layouts/page/page-preferences.js';
import type { DisplayRegistration } from '../../registry/workspace.js';
import { DisplaySettings } from './display-settings.js';
import { LayoutChoices } from './layout-choices.js';

interface SettingsProps {
  title: string;
  preferences: PagePreferences;
  panels: readonly DisplayRegistration[];
  save: (value: PagePreferences) => void;
  close: () => void;
}

/** Edit a registered workspace layout without binding the editor to page-specific content. */
export function PageSettings({ title, preferences, panels, save, close }: SettingsProps) {
  const [draft, setDraft] = useState(preferences);
  return h(
    'section',
    { className: 'arc-surface arc-page-settings', 'aria-label': title },
    h('h2', null, title),
    h(LayoutChoices, {
      columns: draft.columns,
      choose: (columns) => {
        if (columns !== draft.columns) setDraft({ ...draft, columns, widths: [] });
      },
    }),
    h(DisplaySettings, { panels, draft, update: setDraft }),
    h(
      'div',
      { className: 'arc-form-actions arc-settings-actions' },
      h(Button, { onClick: close }, 'Close'),
      h(Button, { className: 'arc-solid', onClick: () => save(draft) }, 'Save'),
    ),
  );
}
