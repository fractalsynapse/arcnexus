import { createElement as h } from 'react';
import { TokenPair } from '../content/token-pair.js';
import type { CommandState } from './command-binding.js';

export function RoundValues({
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
        h(
          'span',
          { key: label },
          label,
          ' ',
          h('strong', null, typeof value === 'string' ? value : h(TokenPair, value)),
        ),
      ),
    ),
  );
}
