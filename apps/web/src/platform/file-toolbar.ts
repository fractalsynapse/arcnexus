import { createElement as h } from 'react';
import { DialogButton, SelectField, WorkspaceLink } from '../../../../packages/ui/src/index.js';
import type { WebCommands } from '../plugins/command-binding-plugin.js';
import { guideLink } from './guide.js';
import { usePlanFile } from './plan-file-scope.js';
import { SaveGoal } from './save-goal.js';

/** Keep revision selection and editing aligned below the recorded path. */
export function FileToolbar({ binding }: { binding: WebCommands }) {
  const file = usePlanFile();
  const entry = file.detail.value?.entry;
  return h(
    'div',
    { className: 'arc-file-toolbar' },
    entry && h('code', { className: 'arc-file-path' }, entry.path),
    h(
      'div',
      { className: 'arc-file-revision' },
      h(SelectField<string>, {
        label: 'File revision',
        value: file.version,
        onChange: file.select,
        options: revisionOptions(file.revision, file.revisions.value?.revisions ?? []),
      }),
      h(CurrentCaptureLink),
      h(FileActions, { binding }),
    ),
    file.revisions.error && h('p', { role: 'alert' }, file.revisions.error),
  );
}

function FileActions({ binding }: { binding: WebCommands }) {
  const file = usePlanFile();
  if (file.route?.kind !== 'goals') return null;
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
        checked: file.editing,
        disabled: !file.detail.value || !!file.version,
        onChange: (event) => file.edit(event.currentTarget.checked),
      }),
      'Edit',
    ),
    file.editing && h(SaveGoal, { binding }),
  );
}

function revisionOptions(
  capture?: string,
  history: readonly { revision: string; updated: string }[] = [],
) {
  return [
    { value: '', label: capture ? capture + ' · Selected capture' : 'Selected capture' },
    ...history
      .filter(({ revision }) => revision !== capture)
      .map(({ revision, updated }) => ({
        value: revision,
        label: revision + ' · ' + new Date(updated).toLocaleString(),
      })),
  ];
}

function CurrentCaptureLink() {
  const { project, route, revision } = usePlanFile();
  if (!project || !route || project.revision === revision) return null;
  return h(
    WorkspaceLink,
    { href: guideLink(route.kind, route.id, project.id, project.revision) },
    'Open current capture',
  );
}
