import { createElement as h, useState } from 'react';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';

export type PlanReadout = 'outcome' | 'metrics';

interface CurrentPlan {
  execution: string | null;
  revision: string | null;
  active: boolean;
}

interface Outcome {
  active: boolean;
  outcome?: { kind?: string; summary?: string; reason?: string } | null;
}

interface Metrics {
  wallElapsedMs?: number | null;
  nativeElapsedMs?: number | null;
  usage?: {
    input_tokens?: { reported?: number | null };
    output_tokens?: { reported?: number | null };
    cached_input_tokens?: { reported?: number | null };
  };
}

/** Mount one Plan projection against the stable execution selected for the current project. */
export function PlanDisplay({ kind }: { kind: PlanReadout }) {
  const { project, token } = usePlatformSession();
  const base = project && '/projects/' + project.id + '/plan-executions/';
  const current = useResource<CurrentPlan>(base && base + 'current', token);
  const execution = current.value?.execution;
  const result = useResource<Outcome & Metrics>(
    base && execution ? base + encodeURIComponent(execution) + '/' + kind : undefined,
    token,
  );
  const unavailable = current.error ?? result.error;
  if (!project) return h('p', null, 'Select a project to view Planner ' + kind + '.');
  if (unavailable) return h('p', { role: 'alert' }, unavailable);
  if (current.value && !execution) return h('p', null, 'No recorded planning execution.');
  if (!result.value) return h('p', { role: 'status' }, 'Loading Planner ' + kind + '…');
  return kind === 'outcome'
    ? outcome(result.value)
    : h(
        'div',
        { className: 'arc-platform-stack' },
        metrics(result.value),
        h(ToolFrequency, { path: base + encodeURIComponent(execution!) + '/tool-counts', token }),
      );
}

function outcome({ active, outcome }: Outcome) {
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h('strong', null, active ? 'Active' : (outcome?.kind ?? 'Recorded')),
    outcome?.summary && h('p', null, outcome.summary),
    outcome?.reason && h('p', null, outcome.reason),
  );
}

function metrics(value: Metrics) {
  const input = value.usage?.input_tokens?.reported;
  const output = value.usage?.output_tokens?.reported;
  const cached = value.usage?.cached_input_tokens?.reported;
  const rate =
    input != null && input > 0 && cached != null
      ? ((cached / input) * 100).toFixed(1) + '%'
      : 'Unavailable';
  const entries = [
    ['Wall time', seconds(value.wallElapsedMs)],
    ['Model time', seconds(value.nativeElapsedMs)],
    ['Reported tokens', thousands(input) + ' / ' + thousands(output) + ' (input / output)'],
    ['Token cache rate', rate],
  ];
  return h(
    'dl',
    { className: 'arc-plan-metrics' },
    entries.map(([label, value]) =>
      h('div', { key: label }, h('dt', null, label), h('dd', null, value)),
    ),
  );
}

function seconds(value?: number | null) {
  return value == null ? 'Unavailable' : (value / 1000).toFixed(1) + ' s';
}

function thousands(value?: number | null) {
  return value == null ? 'Unavailable' : (value / 1000).toFixed(1) + 'K';
}

function ToolFrequency({ path, token }: { path: string; token?: string }) {
  const [open, setOpen] = useState(false);
  const result = useResource<{ entries: Array<{ name: string; calls: number }> }>(
    open ? path : undefined,
    token,
  );
  return h(
    'details',
    {
      onToggle: (event) =>
        setOpen(event.currentTarget instanceof HTMLDetailsElement && event.currentTarget.open),
    },
    h('summary', null, 'Tools by frequency'),
    open && result.error && h('p', { role: 'alert' }, result.error),
    open &&
      result.value &&
      h(
        'ul',
        null,
        result.value.entries.map(({ name, calls }) => h('li', { key: name }, name + ' · ' + calls)),
      ),
  );
}
