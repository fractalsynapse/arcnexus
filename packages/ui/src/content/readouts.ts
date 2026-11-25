import { createElement as h } from 'react';
import type { ReactNode } from 'react';

/** Display paired labels and values in a compact mobile-friendly list. */
export function Readouts({ values }: { values: readonly (readonly [string, ReactNode])[] }) {
  return h(
    'dl',
    { className: 'arc-readouts' },
    values.map(([label, value]) =>
      h('div', { key: label }, h('dt', null, label), h('dd', null, value)),
    ),
  );
}
