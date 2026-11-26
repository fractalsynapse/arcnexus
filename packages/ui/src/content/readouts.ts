import { createElement as h } from 'react';
import type { ReactNode } from 'react';

/** Display paired labels and values in a compact mobile-friendly list. */
export function Readouts({
  values,
  className = '',
}: {
  values: readonly (readonly [string, ReactNode])[];
  className?: string;
}) {
  return h(
    'dl',
    { className: ('arc-readouts ' + className).trim() },
    values.map(([label, value]) =>
      h('div', { key: label }, h('dt', null, label), h('dd', null, value)),
    ),
  );
}
