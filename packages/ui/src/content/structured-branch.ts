import { createElement as h, useState, type ReactNode } from 'react';

/** Mount a structured value's children only while its disclosure is open. */
export function StructuredBranch({
  label,
  expanded = false,
  render,
}: {
  label: ReactNode;
  expanded?: boolean;
  render: () => ReactNode;
}) {
  const [open, setOpen] = useState(expanded);
  return h(
    'details',
    {
      className: 'arc-structured-branch',
      open,
      onToggle: (event) => setOpen(event.currentTarget.hasAttribute('open')),
    },
    h('summary', null, label),
    open && h('div', null, render()),
  );
}
