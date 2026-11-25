import { createElement as h } from 'react';
import { DialogButton } from '../../../../packages/ui/src/index.js';
import type { WebCommands } from '../plugins/command-binding-plugin.js';
import { ActiveProject } from './active-project.js';
import { usePlanFile } from './plan-file-scope.js';
import { SaveGoal } from './save-goal.js';

/** Keep file actions in the same heading area as the active project. */
export function FileContext({ binding }: { binding: WebCommands }) {
  const file = usePlanFile();
  return h(
    'div',
    { className: 'arc-platform-inline' },
    h(ActiveProject),
    file.project && file.route?.kind === 'goals' && h(FileActions, { binding }),
  );
}

function FileActions({ binding }: { binding: WebCommands }) {
  const { canEdit, detail, editing, edit } = usePlanFile();
  return h(
    'div',
    { className: 'arc-platform-inline' },
    h(DialogButton, {
      icon: 'metrics',
      title: 'Progress',
      children: h('p', null, 'A verified measure is required to display goal progress.'),
    }),
    h(
      'label',
      { className: 'arc-guide-checkbox' },
      h('input', {
        type: 'checkbox',
        checked: editing,
        disabled: !detail.value || !canEdit,
        onChange: (event) => edit(event.currentTarget.checked),
      }),
      'Edit',
    ),
    editing && h(SaveGoal, { binding }),
  );
}
