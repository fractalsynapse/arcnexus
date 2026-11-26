import { createElement as h } from 'react';
import { TokenPair, type TokenUsage } from './token-pair.js';

export interface TokenSample extends TokenUsage {
  sequence: string;
  timestamp: string | null;
}

/** List timestamped cumulative provider reports without interpolating missing usage. */
export function TokenHistory({ samples }: { samples: readonly TokenSample[] }) {
  if (!samples.length) return h('p', null, 'No token reports recorded yet.');
  return h(
    'table',
    { className: 'arc-token-history', 'aria-label': 'Cumulative reported tokens' },
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', { scope: 'col' }, 'Time'),
        h('th', { scope: 'col' }, 'Cumulative tokens'),
      ),
    ),
    h('tbody', null, samples.map(sampleRow)),
  );
}

function sampleRow({ sequence, timestamp, input, output }: TokenSample) {
  return h(
    'tr',
    { key: sequence },
    h(
      'td',
      null,
      timestamp
        ? h('time', { dateTime: timestamp }, new Date(timestamp).toLocaleTimeString())
        : '—',
    ),
    h('td', null, h(TokenPair, { input, output })),
  );
}
