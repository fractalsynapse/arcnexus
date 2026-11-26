import { createElement as h, Fragment } from 'react';
import { TokenPair, type TokenUsage } from './token-pair.js';

export interface RunTokenReport extends TokenUsage {
  id: string;
  label: string;
  unavailable?: boolean;
}

/** Show recorded usage per run and total each reported category independently. */
export function TokenHistory({ label, runs }: { label: string; runs: readonly RunTokenReport[] }) {
  return h(
    Fragment,
    null,
    h('p', null, 'Totals include recorded usage. A dash means no count was reported.'),
    h(
      'table',
      { className: 'arc-token-history', 'aria-label': label },
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          h('th', { scope: 'col' }, 'Run'),
          h('th', { scope: 'col' }, 'Reported tokens'),
        ),
      ),
      h('tbody', null, runs.map(reportRow)),
      h('tfoot', null, totalsRow(runs)),
    ),
  );
}

function reportRow({ id, label, unavailable, input, output }: RunTokenReport) {
  return h(
    'tr',
    { key: id },
    h('th', { scope: 'row' }, label),
    h('td', null, unavailable ? 'Could not load' : h(TokenPair, { input, output })),
  );
}

function totalsRow(runs: readonly RunTokenReport[]) {
  return h(
    'tr',
    null,
    h('th', { scope: 'row' }, 'Total reported'),
    h('td', null, h(TokenPair, { input: total(runs, 'input'), output: total(runs, 'output') })),
  );
}

function total(runs: readonly RunTokenReport[], kind: keyof TokenUsage) {
  return runs.reduce<number | null>((sum, run) => {
    const reported = run[kind];
    return reported == null ? sum : (sum ?? 0) + reported;
  }, null);
}
