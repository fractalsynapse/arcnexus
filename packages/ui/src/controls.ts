import { createElement as h, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon, type IconName } from './icons.js';
import { Tooltip } from './tooltip.js';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Provide the visible tooltip and accessible name for a compact action. */
export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return h(
    Tooltip,
    { label },
    h(
      'button',
      {
        type: 'button',
        className: ('arc-icon-button ' + className).trim(),
        'aria-label': label,
        ...props,
      },
      h(Icon, { name: icon }),
    ),
  );
}

/** Render the standard text action, with an optional icon. */
export function Button({
  icon,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  return h(
    'button',
    { type: 'button', className: ['arc-button', className].filter(Boolean).join(' '), ...props },
    icon && h(Icon, { name: icon }),
    children,
  );
}

interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}

/** Put all shell dialogs in the browser modal layer and return focus to their opener. */
export function Dialog({ title, open, onClose, children }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  return h(
    'dialog',
    { ref: dialog, className: 'arc-dialog', 'aria-labelledby': heading, onClose },
    h(
      'div',
      { className: 'arc-dialog-header' },
      h('h2', { id: heading }, title),
      h(Button, { onClick: () => dialog.current?.close() }, 'Close'),
    ),
    open && h('div', { className: 'arc-dialog-body' }, children),
  );
}

/** Keep a responsive control aligned with its media query across viewport changes. */
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
