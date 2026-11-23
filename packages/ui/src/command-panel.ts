import { createElement as h, useId, useState, useSyncExternalStore } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Dialog, IconButton, useMedia } from './controls.js';
import { Icon } from './icons.js';
import { operations } from './types.js';
import type { CommandBinding, CommandRequest, CommandState, Operation } from './types.js';

const launchOperations: readonly Operation[] = ['plan', 'architect', 'run'];

interface DockProps {
  binding: CommandBinding;
  workspace: string;
}

interface ReadoutProps {
  state: CommandState;
  collapsed: boolean;
  body: string;
  toggle: () => void;
  showMetrics: () => void;
}

/** Render the docked composer and round state from the injected command binding. */
export function CommandPanel({ binding, workspace }: DockProps) {
  const state = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const mobile = useMedia('(max-width: 590px)');
  const [override, setOverride] = useState<boolean>();
  const [metrics, setMetrics] = useState(false);
  const collapsed = override ?? mobile;
  const body = useId();
  return h(
    'footer',
    {
      className: 'arc-command-panel',
      'aria-label': 'Command controls',
      'data-collapsed': collapsed || undefined,
    },
    h('div', { id: body, hidden: collapsed }, h(Composer, { state, binding, workspace })),
    h(RoundReadout, {
      state,
      collapsed,
      body,
      toggle: () => setOverride(!collapsed),
      showMetrics: () => setMetrics(true),
    }),
    h(
      Dialog,
      { title: 'End-to-end refinement metrics', open: metrics, onClose: () => setMetrics(false) },
      h(RoundMetrics, { state }),
    ),
  );
}

function RoundReadout({ state, collapsed, body, toggle, showMetrics }: ReadoutProps) {
  const details = useId();
  return h(
    'div',
    { className: 'arc-command-readout', role: 'group', 'aria-label': 'Round state' },
    h(IconButton, {
      icon: 'metrics',
      label: 'Round metrics',
      'aria-haspopup': 'dialog',
      onClick: showMetrics,
    }),
    h(RoundValues, { state, collapsed, details }),
    h(IconButton, {
      icon: collapsed ? 'up' : 'down',
      label: collapsed ? 'Expand command panel' : 'Collapse command panel',
      'aria-expanded': !collapsed,
      'aria-controls': body + ' ' + details,
      onClick: toggle,
    }),
  );
}

function RoundValues({
  state,
  collapsed,
  details,
}: {
  state: CommandState;
  collapsed: boolean;
  details: string;
}) {
  return h(
    'div',
    { className: 'arc-round-values', role: 'status' },
    h('span', { className: 'arc-status' }, state.status),
    h('strong', null, state.command ?? '—'),
    h(
      'div',
      { id: details, className: 'arc-round-details', hidden: collapsed },
      state.metrics?.map(([label, value]) =>
        h('span', { key: label }, label, ' ', h('strong', null, value)),
      ),
    ),
  );
}

function RoundMetrics({ state }: { state: CommandState }) {
  const entries = state.metrics ?? [];
  return h(
    'dl',
    { className: 'arc-metric-list' },
    [['State', state.status], ['Command', state.command ?? 'Unavailable'], ...entries].map(
      ([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value)),
    ),
    entries.length === 0 &&
      h('div', null, h('dt', null, 'Round measurements'), h('dd', null, 'Unavailable')),
  );
}

interface ComposerProps extends DockProps {
  state: CommandState;
}

function Composer(props: ComposerProps) {
  const { instruction, setInstruction, options, operation, setSelection, enabled, send, error } =
    useComposer(props);
  return h(
    'form',
    { className: 'arc-composer', onSubmit: send },
    h(InstructionField, { instruction, setInstruction }),
    h(OperationField, { options, operation, setSelection }),
    h(
      'button',
      {
        type: 'submit',
        className: 'arc-button arc-solid arc-send',
        disabled: !enabled,
        'aria-label': 'Send',
        title: 'Send',
      },
      h(Icon, { name: 'send' }),
    ),
    error && h('p', { role: 'alert', className: 'arc-composer-error' }, error),
  );
}

function useComposer({ binding, workspace, state }: ComposerProps) {
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

function InstructionField({
  instruction,
  setInstruction,
}: {
  instruction: string;
  setInstruction: (value: string) => void;
}) {
  return h(
    'label',
    { className: 'arc-instruction' },
    h('span', null, 'Instruction ', h('small', null, 'optional')),
    h('textarea', {
      rows: 1,
      value: instruction,
      placeholder: 'Add an instruction…',
      onChange: ({ currentTarget }: ChangeEvent<HTMLTextAreaElement>) =>
        setInstruction(currentTarget.value),
    }),
  );
}

function OperationField({
  options,
  operation,
  setSelection,
}: {
  options: readonly Operation[];
  operation: Operation;
  setSelection: (value: Operation) => void;
}) {
  const id = useId();
  return h(
    'div',
    { className: 'arc-operation arc-field' },
    h('label', { htmlFor: id }, 'Operation'),
    h(
      'select',
      {
        id,
        value: operation,
        onChange: ({ currentTarget }: ChangeEvent<HTMLSelectElement>) =>
          setSelection(currentTarget.value as Operation),
      },
      options.map((item) => h('option', { key: item, value: item }, operations[item])),
    ),
  );
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
