import { createElement as h } from 'react';
import { Readouts } from '../content/readouts.js';
import type { CommandState } from './command-binding.js';
import { roundMeasurements } from './round-measurements.js';

export function RoundMetrics({ state }: { state: CommandState }) {
  const entries = roundMeasurements(state);
  return h(Readouts, {
    className: 'arc-metric-list',
    values: [
      ['State', state.status],
      ['Command', state.command ?? 'Unavailable'],
      ...(entries.length ? entries : ([['Round measurements', 'Unavailable']] as const)),
    ],
  });
}
