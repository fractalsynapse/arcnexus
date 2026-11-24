import { dom, root } from './model.ts';
import { copyPanelPalette } from './display-colors.ts';

let restoreProse: (() => void) | undefined;

function proseField(trigger: HTMLElement) {
  return trigger.closest('.arc-prose-field')?.querySelector<HTMLDetailsElement>('details');
}

export function collapseProse(trigger: HTMLElement) {
  const disclosure = proseField(trigger);
  const summary = disclosure?.querySelector<HTMLElement>('summary');
  if (!disclosure || !summary) return;
  disclosure.open = false;
  returnTo(summary);
}

export function showProse(opener: HTMLButtonElement, mountEditor: (host: HTMLElement) => void) {
  const dialog = dom<HTMLDialogElement>('.arc-prose-dialog');
  if (dialog.open) return;
  restoreProse?.();
  const disclosure = proseField(opener);
  const field = disclosure?.querySelector<HTMLElement>('[data-prose-content]');
  if (!disclosure || !field) return;
  const position = document.createComment('prose field position');
  field.before(position);
  const scroll = dom('.arc-prose-scroll');
  scroll.append(field);
  prepareDialog(opener, dialog);
  disclosure.open = false;
  const stopTracking = trackEmbeddedViewport(dialog);
  const restore = () => {
    if (dialog.open) return;
    dialog.removeEventListener('close', restore);
    restoreProse = undefined;
    stopTracking();
    position.replaceWith(field);
    disclosure.open = false;
    returnTo(opener);
  };
  restoreProse = restore;
  dialog.addEventListener('close', restore);
  dialog.showModal();
  scroll.scrollTop = 0;
  const editor = field.querySelector<HTMLElement>('[data-yaml-markdown]');
  if (editor) mountEditor(editor);
}

function prepareDialog(opener: HTMLButtonElement, dialog: HTMLDialogElement) {
  copyPanelPalette(opener, dialog);
  dom('#arc-prose-heading').textContent = opener.dataset.proseTitle ?? '';
}

export function closeProse() {
  const dialog = dom<HTMLDialogElement>('.arc-prose-dialog');
  if (dialog.open) dialog.close();
  restoreProse?.();
}

function returnTo(control: HTMLElement) {
  if (!control.isConnected) return;
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}

function trackEmbeddedViewport(dialog: HTMLDialogElement) {
  if (window === window.parent) return () => {};
  // A tall embedded preview can extend below the parent viewport.
  const observer = new IntersectionObserver(([entry]) => {
    const visible = entry?.intersectionRect;
    if (!visible?.height || !visible.width) return;
    dialog.style.insetBlockStart = visible.y + 'px';
    dialog.style.insetInlineStart = visible.x + 'px';
    dialog.style.inlineSize = visible.width + 'px';
    dialog.style.blockSize = visible.height + 'px';
  });
  observer.observe(root);
  return () => {
    observer.disconnect();
    dialog.removeAttribute('style');
  };
}
