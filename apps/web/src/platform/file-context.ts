import { createElement as h } from 'react';
import { CheckboxField, DialogButton, Tooltip } from '../../../../packages/ui/src/index.js';
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
  const checkbox = h(CheckboxField, {
    label: 'Edit',
    checked: editing,
    disabled: !detail.value || !canEdit,
    onChange: edit,
  });
  return h(
    'div',
    { className: 'arc-platform-inline' },
    h(DialogButton, {
      icon: 'metrics',
      title: 'Progress',
      children: h('p', null, 'A verified measure is required to display goal progress.'),
    }),
    canEdit
      ? checkbox
      : h(
          Tooltip,
          {
            label: 'Historical revisions are read-only. Select Latest revision to edit.',
            focusAnchor: true,
          },
          checkbox,
        ),
    editing && h(SaveGoal, { binding }),
  );
}
