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
  const current = tabs.indexOf(tab);
  const vertical = group.getAttribute('aria-orientation') === 'vertical';
  const candidate = {
    [vertical ? 'ArrowUp' : 'ArrowLeft']: (current - 1 + tabs.length) % tabs.length,
    [vertical ? 'ArrowDown' : 'ArrowRight']: (current + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }[event.key];
  if (candidate === undefined || !tabs[candidate]) return;
  event.preventDefault();
  selectTab(tabs[candidate]);
}
