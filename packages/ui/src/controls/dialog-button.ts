import { createElement as h, Fragment, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './dialog.js';
import { Button } from './button.js';
import { IconButton } from './icon-button.js';
import type { IconName } from './icon.js';

export type DialogButtonProps = {
  title: string;
  children: ReactNode;
} & ({ icon: IconName; label?: never } | { icon?: never; label: string });

/** Open a shared dialog with the frame theme and return focus to its trigger. */
export function DialogButton({ icon, title, label, children }: DialogButtonProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [frame, setFrame] = useState<Element | null>(null);
  const close = () => {
    setFrame(null);
    trigger.current?.focus({ preventScroll: true });
  };
  const action = {
    ref: trigger,
    'aria-haspopup': 'dialog' as const,
    onClick: (event: MouseEvent<HTMLButtonElement>) =>
      setFrame(event.currentTarget.closest('.arc-app')),
  };
  return h(
    Fragment,
    null,
    icon !== undefined
      ? h(IconButton, { ...action, icon, label: title })
      : h(Button, { ...action, 'aria-label': label + ' · ' + title }, label),
    frame && createPortal(h(Dialog, { title, open: true, onClose: close }, children), frame),
  );
}
