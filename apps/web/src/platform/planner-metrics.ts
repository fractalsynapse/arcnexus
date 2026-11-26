import { createElement as h } from 'react';
import {
  Disclosure,
  elapsedTime,
  Readouts,
  TokenPair,
  Tooltip,
  useElapsedClock,
  type TokenDetails,
} from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';
import { PlanTokenHistory } from './plan-token-history.js';

type Reported = { reported?: number | null };
export interface PlanMetrics {
  wallElapsedMs?: number | null;
  nativeElapsedMs?: number | null;
  profiles?: Array<{ activeActivations?: number }>;
  usage?: { input_tokens?: Reported; output_tokens?: Reported; cached_input_tokens?: Reported };
}

/** Render the current measurements with on-demand details. */
export function PlannerMetrics({
  value,
  path,
  refresh,
  running = false,
}: {
  value: PlanMetrics;
  path: string;
  refresh?: string;
  running?: boolean;
}) {
  const snapshot = useTickingTimes(value, running);
  const tokens = { title: 'Reported tokens across Plan runs', content: h(PlanTokenHistory) };
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(Readouts, { values: metricRows(value, snapshot, tokens) }),
    h(
      Disclosure,
      { label: 'Tools by frequency' },
      h(ToolFrequency, { path: path + '/tool-counts', refresh }),
    ),
  );
}

function useTickingTimes(value: PlanMetrics, running: boolean) {
  const offset = useElapsedClock(running && value.wallElapsedMs != null, value);
  const native = (value.profiles ?? []).reduce(
    (count, profile) => count + (profile.activeActivations ?? 0),
    0,
  );
  return {
    wall: value.wallElapsedMs == null ? value.wallElapsedMs : value.wallElapsedMs + offset,
    agent:
      value.nativeElapsedMs == null
        ? value.nativeElapsedMs
        : value.nativeElapsedMs + offset * native,
  };
}

function metricRows(
  value: PlanMetrics,
  { wall, agent }: ReturnType<typeof useTickingTimes>,
  details: TokenDetails,
) {
  const input = value.usage?.input_tokens?.reported;
  const output = value.usage?.output_tokens?.reported;
  const cached = value.usage?.cached_input_tokens?.reported;
  const rate =
    input != null && input > 0 && cached != null
      ? ((cached / input) * 100).toFixed(1) + '%'
      : 'Unavailable';
  return [
    ['Wall time', elapsedTime(wall)],
    ['Agent elapsed', h(AgentElapsed, { milliseconds: agent })],
    ['Reported tokens', h(TokenPair, { input, output, details })],
    ['Token cache rate', rate],
  ] as const;
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
    h('span', { tabIndex: 0 }, elapsedTime(milliseconds)),
  );
}
