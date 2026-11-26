import { useState, type FormEvent } from 'react';
import type { Operation, CommandState } from './command-binding.js';
import type { DockProps } from './command-panel.js';
import { useCommandAction } from './use-command-action.js';

const launchOperations: readonly Operation[] = ['plan', 'architect', 'run'];

export interface ComposerProps extends DockProps {
  state: CommandState;
}

export function useComposer({ binding, workspace, state }: ComposerProps) {
  const [selection, setSelection] = useState<Operation>();
  const [instruction, setInstruction] = useState('');
  const { pending, error, perform } = useCommandAction();
  const options = commandOptions(state);
  const operation = selectOperation(options, selection);
  const enabled = Boolean(binding.submit && state.supported.includes(operation)) && !pending;
  const recommendation = useRecommendation(operation, state);
  const send = useSubmit({
    binding,
    workspace,
    instruction,
    operation,
    enabled,
    recommendation: recommendation?.checked,
    setInstruction,
    perform,
  });
  return {
    instruction,
    setInstruction,
    options,
    operation,
    setSelection,
    enabled,
    send,
    error,
    recommendation,
  };
}

function selectOperation(options: readonly Operation[], selection?: Operation): Operation {
  if (selection && options.includes(selection)) return selection;
  return options.includes('steer') ? 'steer' : (options[0] ?? 'plan');
}

function commandOptions(state: CommandState): readonly Operation[] {
  if (state.supported.length) return state.supported;
  return launchOperations;
}

function useRecommendation(operation: Operation, state: CommandState) {
  const [recommend, setRecommend] = useState(true);
  if (operation !== 'plan' || !state.canRecommendObjectives || !state.supported.includes(operation))
    return;
  return {
    checked: recommend,
    onChange: setRecommend,
  };
}

interface ComposerSubmission extends Pick<DockProps, 'binding' | 'workspace'> {
  instruction: string;
  operation: Operation;
  enabled: boolean;
  recommendation?: boolean;
  setInstruction(update: (current: string) => string): void;
  perform: ReturnType<typeof useCommandAction>['perform'];
}

function useSubmit({
  binding,
  workspace,
  instruction,
  operation,
  enabled,
  recommendation,
  setInstruction,
  perform,
}: ComposerSubmission) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!binding.submit || !enabled) return;
    void perform(async () => {
      await binding.submit!({
        operation,
        instruction,
        workspace,
        ...(recommendation !== undefined && {
          recommendObjectives: recommendation,
        }),
      });
      setInstruction((current) => (current === instruction ? '' : current));
    }, 'Command could not be submitted.');
  };
}
