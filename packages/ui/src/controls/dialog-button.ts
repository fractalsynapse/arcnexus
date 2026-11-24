import { createElement as h, Fragment, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './dialog.js';
import { IconButton } from './icon-button.js';
import type { IconName } from './icon.js';

export interface DialogButtonProps {
  icon: IconName;
  title: string;
  children: ReactNode;
}

/** Open a shared dialog with the frame theme and return focus to its icon. */
export function DialogButton({ icon, title, children }: DialogButtonProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [frame, setFrame] = useState<Element | null>(null);
  const close = () => {
    setFrame(null);
    trigger.current?.focus({ preventScroll: true });
  };
  return h(
    Fragment,
    null,
    h(IconButton, {
      ref: trigger,
      icon,
      label: title,
      'aria-haspopup': 'dialog',
      onClick: (event) => setFrame(event.currentTarget.closest('.arc-app')),
    }),
    frame && createPortal(h(Dialog, { title, open: true, onClose: close }, children), frame),
  );
}
