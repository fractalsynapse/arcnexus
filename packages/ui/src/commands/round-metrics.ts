import { createElement as h } from 'react';
import { TokenPair } from '../content/token-pair.js';
import type { CommandState } from './command-binding.js';

export function RoundMetrics({ state }: { state: CommandState }) {
  const entries = state.metrics ?? [];
  const values = [
    ['State', state.status],
    ['Command', state.command ?? 'Unavailable'],
    ...entries,
  ] as const;
  return h(
    'dl',
    { className: 'arc-metric-list' },
    values.map(([label, value]) =>
      h(
        'div',
        { key: label },
        h('dt', null, label),
        h('dd', null, typeof value === 'string' ? value : h(TokenPair, value)),
      ),
    ),
    entries.length === 0 &&
      h('div', null, h('dt', null, 'Round measurements'), h('dd', null, 'Unavailable')),
  );
}
