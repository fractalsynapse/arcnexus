import { tabDestination } from '../../../packages/ui/src/controls/tab-navigation.js';

export function selectTab(tab: HTMLButtonElement) {
  const group = tab.closest('[role="tablist"]');
  if (!group) return;
  for (const option of group.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    const active = option === tab;
    option.setAttribute('aria-selected', String(active));
    option.tabIndex = active ? 0 : -1;
    const panel = option.ownerDocument.getElementById(option.getAttribute('aria-controls') ?? '');
    if (panel) panel.hidden = !active;
  }
  tab.focus();
}

export function navigateTabs(event: KeyboardEvent, tab: HTMLButtonElement) {
  const group = tab.closest('[role="tablist"]');
  if (!group) return;
  const tabs = [...group.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const vertical = group.getAttribute('aria-orientation') === 'vertical';
  const candidate = tabDestination(event.key, tabs.indexOf(tab), tabs.length, vertical);
  if (candidate === undefined || !tabs[candidate]) return;
  event.preventDefault();
  selectTab(tabs[candidate]);
}
