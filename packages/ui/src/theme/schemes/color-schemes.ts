import { createElement as h } from 'react';
import type { Theme } from '../theme.js';
import { SchemeEditor } from './scheme-editor.js';
import { SchemeSelect } from './scheme-select.js';

/** Edit the reusable scheme library and choose the background for the whole app. */
export function ColorSchemes({ theme }: { theme: Theme }) {
  return h(
    'div',
    { className: 'arc-schemes' },
    h(SchemeSelect, {
      label: 'Site background and default scheme',
      selected: theme.selected,
      schemes: theme.schemes,
      defaultName: 'ArcNexus default',
      defaultColors: theme.defaultColors,
      choose: theme.select,
    }),
    h(SchemeEditor, { theme }),
  );
}
