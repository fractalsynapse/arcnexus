import { createElement as h, useState, useSyncExternalStore } from 'react';
import { Button, useCommandAction } from '../../../../packages/ui/src/index.js';
import type { WebCommands } from '../plugins/command-binding-plugin.js';
import { usePlanFile } from './plan-file-scope.js';

/** Request approval for an exact draft at the currently bound project revision. */
export function SaveGoal({ binding }: { binding: WebCommands }) {
  const file = usePlanFile();
  const commands = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const { pending, perform, error } = useCommandAction();
  const [submitted, record] = useState<string>();
  const detail = file.detail.value;
  if (file.route?.kind !== 'goals' || !detail || !file.revision || file.draft === undefined)
    return null;
  const current = file.canEdit;
  const { draft: content, revision } = file;
  const ready = binding.saveGoal && current && commands.supported.includes('plan');
  const disabled = !ready || content === detail.content || pending || submitted === content;
  const submit = () =>
    void perform(async () => {
      await binding.saveGoal!({ id: detail.entry.id, revision, content });
      record(content);
    }, 'The goal draft could not be submitted.');
  return h(SaveControls, {
    disabled,
    current,
    pending,
    submitted: submitted === content,
    error,
    submit,
  });
}

function SaveControls({
  disabled,
  current,
  pending,
  submitted,
  error,
  submit,
}: {
  disabled: boolean;
  current: boolean;
  pending: boolean;
  submitted: boolean;
  error: string;
  submit: () => void;
}) {
  return h(
    'div',
    { className: 'arc-platform-inline' },
    h(Button, { disabled, onClick: submit }, pending ? 'Submitting…' : 'Save'),
    !current && h('small', { role: 'status' }, 'Select Latest revision to submit this edit.'),
    submitted && h('small', { role: 'status' }, 'Submitted for approval.'),
    error && h('small', { role: 'alert' }, error),
  );
}
