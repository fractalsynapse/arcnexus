import { createElement as h, useState } from 'react';
import type { ReactNode } from 'react';

/** Keep expensive or independently loaded content unmounted until the section opens. */
export function Disclosure({ label, children }: { label: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return h(
    'details',
    {
      className: 'arc-disclosure',
      onToggle: (event) => setOpen(event.currentTarget.hasAttribute('open')),
    },
    h('summary', null, label),
    open && children,
  );
}
