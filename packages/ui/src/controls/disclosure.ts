import { createElement as h, useState } from 'react';
import type { ReactNode } from 'react';

/** Keep expensive or independently loaded content unmounted until the section opens. */
export function Disclosure({
  label,
  children,
  className = 'arc-disclosure',
  defaultOpen = false,
}: {
  label: ReactNode;
  children?: ReactNode | (() => ReactNode);
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return h(
    'details',
    {
      className,
      open,
      onToggle: (event) => setOpen(event.currentTarget.hasAttribute('open')),
    },
    h('summary', null, label),
    open && (typeof children === 'function' ? children() : children),
  );
}
