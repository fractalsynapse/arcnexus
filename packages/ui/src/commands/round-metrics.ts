import { createElement as h } from 'react';
import type { CommandState } from './command-binding.js';

export function RoundMetrics({ state }: { state: CommandState }) {
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
