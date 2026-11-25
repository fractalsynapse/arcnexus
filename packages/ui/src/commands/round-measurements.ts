import { createElement as h } from 'react';
import { TokenPair } from '../content/token-pair.js';
import type { CommandState } from './command-binding.js';

/** Render each recorded metric consistently in the dock and its full readout. */
export function roundMeasurements(state: CommandState) {
  return (state.metrics ?? []).map(
    ([label, value]) => [label, typeof value === 'string' ? value : h(TokenPair, value)] as const,
  );
}
