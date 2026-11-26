import { createElement as h } from 'react';
import { Disclosure, Readouts, TokenPair, Tooltip } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';

type Reported = { reported?: number | null };
export interface PlanMetrics {
  wallElapsedMs?: number | null;
  nativeElapsedMs?: number | null;
  usage?: { input_tokens?: Reported; output_tokens?: Reported; cached_input_tokens?: Reported };
}

/** Render the measured values and fetch tool counts only when requested. */
export function PlannerMetrics({
  value,
  path,
  refresh,
}: {
  value: PlanMetrics;
  path: string;
  refresh?: string;
}) {
  const input = value.usage?.input_tokens?.reported;
  const output = value.usage?.output_tokens?.reported;
  const cached = value.usage?.cached_input_tokens?.reported;
  const rate =
    input != null && input > 0 && cached != null
      ? ((cached / input) * 100).toFixed(1) + '%'
      : 'Unavailable';
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(Readouts, {
      values: [
        ['Wall time', seconds(value.wallElapsedMs)],
        ['Agent elapsed', h(AgentElapsed, { milliseconds: value.nativeElapsedMs })],
        ['Reported tokens', h(TokenPair, { input, output })],
        ['Token cache rate', rate],
      ],
    }),
    h(Disclosure, { label: 'Tools by frequency' }, h(ToolFrequency, { path, refresh })),
  );
}

function seconds(value?: number | null) {
  return value == null ? 'Unavailable' : (value / 1000).toFixed(1) + ' s';
}

function ToolFrequency({ path, refresh }: { path: string; refresh?: string }) {
  const result = useResource<{ entries: Array<{ name: string; calls: number }> }>(path, refresh);
  if (result.error) return h('p', { role: 'alert' }, result.error);
  if (!result.value) return null;
  return result.value.entries.length
    ? h(Readouts, { values: result.value.entries.map(({ name, calls }) => [name, calls] as const) })
    : h('p', null, 'No tool calls recorded.');
}

function AgentElapsed({ milliseconds }: { milliseconds?: number | null }) {
  return h(
    Tooltip,
    { label: 'Sum of recorded agent activation durations across execution profiles' },
    h('span', { tabIndex: 0 }, seconds(milliseconds)),
  );
}
