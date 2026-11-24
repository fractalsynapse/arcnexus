import { createElement as h, useState, type ReactNode, type SubmitEvent } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';
import { api } from './resource.js';
import { setSession, usePlatformSession } from './session.js';

export function OperatorGate({ children }: { children: ReactNode }) {
  const session = usePlatformSession();
  return session.token ? children : h(CredentialsForm);
}

function CredentialsForm() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    try {
      await api('/projects', input);
      setSession({ token: input });
      setInput('');
    } catch {
      setStatus('The platform could not authenticate this credential.');
    }
  };
  return h(CredentialField, { input, setInput, status, submit });
}

function CredentialField({
  input,
  setInput,
  status,
  submit,
}: {
  input: string;
  setInput(value: string): void;
  status: string;
  submit(event: SubmitEvent): void;
}) {
  return h(
    'form',
    { className: 'arc-platform-stack', onSubmit: submit },
    h(
      'label',
      null,
      'Operator credential',
      h('input', {
        type: 'password',
        autoComplete: 'off',
        required: true,
        value: input,
        onChange: (event) => setInput(event.currentTarget.value),
      }),
    ),
    h(Button, { type: 'submit' }, 'Connect'),
    status && h('p', { role: 'alert' }, status),
  );
}
