import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Operation, CommandState, CommandRequest } from './command-binding.js';
import type { DockProps } from './command-panel.js';

const launchOperations: readonly Operation[] = ['plan', 'architect', 'run'];

export interface ComposerProps extends DockProps {
  state: CommandState;
}

export function useComposer({ binding, workspace, state }: ComposerProps) {
  const [selection, setSelection] = useState<Operation>();
  const [instruction, setInstruction] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const options = state.supported.length ? state.supported : launchOperations;
  const preferred = options.includes('steer') ? 'steer' : (options[0] ?? 'plan');
  const operation = selection && options.includes(selection) ? selection : preferred;
  const enabled = Boolean(binding.submit && state.supported.includes(operation)) && !sending;
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submit = binding.submit;
    if (!submit || !enabled) return;
    setSending(true);
    setError('');
    void sendRequest(
      submit.bind(binding),
      { operation, instruction, workspace },
      setInstruction,
      setError,
      setSending,
    );
  };
  return { instruction, setInstruction, options, operation, setSelection, enabled, send, error };
}

async function sendRequest(
  submit: (request: CommandRequest) => Promise<void>,
  request: CommandRequest,
  setInstruction: (update: (instruction: string) => string) => void,
  setError: (message: string) => void,
  setSending: (sending: boolean) => void,
) {
  try {
    await submit(request);
    setInstruction((instruction) => (instruction === request.instruction ? '' : instruction));
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Command could not be submitted.');
  } finally {
    setSending(false);
  }
}
