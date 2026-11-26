import { createElement as h, useRef, useState, type ChangeEvent, type SubmitEvent } from 'react';
import {
  documentationSettings,
  type DocumentationSettings,
} from '../../../../packages/architecture/src/documentation-settings.js';
import { Button, DialogButton, useCommandAction } from '../../../../packages/ui/src/index.js';
import type { WorkflowRequest } from '../../../../packages/commands/src/request.js';
import { useBrowserPlatform } from './browser-platform.js';
import { projectName, type Project } from './session.js';
import { useResource } from './resource.js';

const submittedMessage =
  'Submitted for architecture review. Open this project’s command panel to review the exact change.';

export function ProjectSettingsButton({ project }: { project: Project }) {
  const name = projectName(project);
  return h(DialogButton, {
    icon: 'settings',
    title: 'Project settings for ' + name,
    children: h(ProjectSettings, { path: '/projects/' + encodeURIComponent(project.id) }),
  });
}

function ProjectSettings({ path }: { path: string }) {
  const resource = useResource<DocumentationSettings>(path + '/settings');
  if (resource.error) return h('p', { role: 'alert' }, 'Unable to load settings for this project.');
  if (!resource.value) return h('p', { role: 'status' }, 'Loading project settings…');
  return h(DocumentationForm, { path, initial: resource.value, key: resource.value.revision });
}

function DocumentationForm({ path, initial }: { path: string; initial: DocumentationSettings }) {
  const state = useDocumentationForm(path, initial);
  return h(
    'form',
    { className: 'arc-platform-stack', onSubmit: state.onSubmit },
    h(
      'label',
      null,
      'Documentation directories',
      h('textarea', {
        value: state.text,
        disabled: state.pending || state.submitted,
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
          state.setText(event.currentTarget.value),
      }),
    ),
    h(
      'small',
      null,
      'Enter one repository-relative folder per line. Leave blank to search the whole repository.',
    ),
    state.error && h('p', { role: 'alert' }, state.error),
    state.submitted
      ? h('p', { role: 'status' }, submittedMessage)
      : h(Button, { type: 'submit', disabled: state.disabled }, 'Submit for review'),
  );
}

function useDocumentationForm(path: string, initial: DocumentationSettings) {
  const [text, setText] = useState(initial.directories.join('\n'));
  const [submitted, setSubmitted] = useState(false);
  const { pending, error, submit } = useDocumentationChange(path, () => setSubmitted(true));
  const directories = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const result = documentationSettings.safeParse({ revision: initial.revision, directories });
  const unchanged = JSON.stringify(initial.directories) === JSON.stringify(directories);
  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (result.success && !unchanged) submit(result.data);
  };
  return {
    text,
    setText,
    pending,
    submitted,
    onSubmit,
    error: error || (!result.success && result.error.issues[0]?.message),
    disabled: pending || unchanged || !result.success,
  };
}

function useDocumentationChange(path: string, complete: () => void) {
  const { gateway } = useBrowserPlatform();
  const { pending, error, perform } = useCommandAction();
  const submission = useRef<{ id: string; key: string } | undefined>(undefined);
  const submit = (documentation: DocumentationSettings) => {
    const request: WorkflowRequest = { command: 'architecture_update', documentation };
    const key = JSON.stringify(request);
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() };
    const { id } = submission.current;
    void perform(async () => {
      await gateway.read(path + '/commands', {
        method: 'POST',
        body: JSON.stringify({ id, request }),
      });
      complete();
    }, 'Could not submit project settings.');
  };
  return { pending, error, submit };
}
