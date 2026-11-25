import { createElement as h, useState } from 'react';
import type { ReactElement } from 'react';

/** Show structured tool and model data without executing embedded markup. */
export function JsonView({
  value,
  expanded = true,
}: {
  value: unknown;
  expanded?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(expanded);
  if (value === null || typeof value !== 'object')
    return h(
      'code',
      { 'data-json': value === null ? 'null' : typeof value },
      JSON.stringify(value) ?? 'Unavailable',
    );
  const list = Array.isArray(value);
  const entries = Object.entries(value);
  return h(
    'details',
    {
      className: 'arc-json-section',
      open,
      onToggle: (event) => setOpen(event.currentTarget.hasAttribute('open')),
    },
    h('summary', null, (list ? '[' : '{') + entries.length + (list ? ']' : '}')),
    open && h(JsonEntries, { entries, list }),
  );
}

function JsonEntries({ entries, list }: { entries: [string, unknown][]; list: boolean }) {
  return h(
    'div',
    null,
    entries.map(([key, child]) =>
      h(
        'div',
        { key, className: 'arc-json-entry' },
        h('code', { 'data-json': 'key' }, list ? key : JSON.stringify(key)),
        h(JsonView, { value: child, expanded: false }),
      ),
    ),
  );
}
