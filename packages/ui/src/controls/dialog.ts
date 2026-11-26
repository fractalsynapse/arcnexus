import { useRef, useId, useEffect, createElement as h } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Button } from './button.js';

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
    {
      ref: dialog,
      className: 'arc-dialog',
      'aria-labelledby': heading,
      onClose: (event: SyntheticEvent<HTMLDialogElement>) => {
        if (event.target === event.currentTarget) onClose();
      },
    },
    h(
      'div',
      { className: 'arc-dialog-header' },
      h('h2', { id: heading }, title),
      h(Button, { onClick: () => dialog.current?.close() }, 'Close'),
    ),
    open && h('div', { className: 'arc-dialog-body' }, children),
  );
}
