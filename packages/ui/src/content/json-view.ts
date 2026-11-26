import { createElement as h } from 'react';
import type { ReactElement } from 'react';
import { StructuredBranch } from './structured-branch.js';

/** Show structured tool and model data without executing embedded markup. */
export function JsonView({
  value,
  expanded = true,
}: {
  value: unknown;
  expanded?: boolean;
}): ReactElement {
  if (value === null || typeof value !== 'object')
    return h(
      'code',
      { 'data-json': value === null ? 'null' : typeof value },
      JSON.stringify(value) ?? 'Unavailable',
    );
  const list = Array.isArray(value);
  const entries = Object.entries(value);
  return h(StructuredBranch, {
    expanded,
    label: (list ? '[' : '{') + entries.length + (list ? ']' : '}'),
    render: () => jsonEntries(entries, list),
  });
}

function jsonEntries(entries: [string, unknown][], list: boolean) {
  return entries.map(([key, child]) =>
    h(
      'div',
      { key, className: 'arc-structured-entry' },
      h('code', { 'data-json': 'key' }, list ? key : JSON.stringify(key)),
      h(JsonView, { value: child, expanded: false }),
    ),
  );
}
