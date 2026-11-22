import { dom, root } from './model.ts';

export function showInspector(opener: HTMLElement, heading: string, body: () => string) {
  const dialog = dom<HTMLDialogElement>('.arc-inspector');
  const content = dom('.arc-inspector-content');
  // The viewer can give the iframe the full page height. Measure its visible
  // intersection at open time, since scrolling may occur in the parent.
  const observer = new IntersectionObserver(([entry]) => {
    observer.disconnect();
    if (dialog.open || !opener.isConnected) return;
    const visible = entry?.intersectionRect;
    const center = visible?.height
      ? (visible.top + visible.bottom) / 2
      : opener.getBoundingClientRect().top;
    dialog.style.setProperty('--arc-dialog-center', center + window.scrollY + 'px');
    dialog.style.setProperty('--arc-dialog-space', (visible?.height || window.innerHeight) + 'px');
    dom('#arc-inspector-heading').textContent = heading;
    content.innerHTML = body();
    dialog.showModal();
    content.scrollTop = 0;
    dialog.addEventListener('close', () => opener.focus({ preventScroll: true }), { once: true });
  });
  observer.observe(root);
}
