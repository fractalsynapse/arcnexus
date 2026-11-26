import { createElement as h, Fragment, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './dialog.js';
import { Button } from './button.js';
import { IconButton } from './icon-button.js';
import { Tooltip } from './tooltip.js';
import type { IconName } from './icon.js';

export type DialogButtonProps = {
  title: string;
  children: ReactNode;
} & (
  | { icon: IconName; label?: never; hint?: never; className?: never }
  | { icon?: never; label: string; hint?: string; className?: string }
);

/** Open a shared dialog with the frame theme and return focus to its trigger. */
export function DialogButton({ icon, title, label, hint, className, children }: DialogButtonProps) {
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
  const button =
    icon !== undefined
      ? h(IconButton, { ...action, icon, label: title })
      : h(Button, { ...action, className, 'aria-label': label + ' · ' + title }, label);
  return h(
    Fragment,
    null,
    hint ? h(Tooltip, { label: hint }, button) : button,
    frame && createPortal(h(Dialog, { title, open: true, onClose: close }, children), frame),
  );
}
