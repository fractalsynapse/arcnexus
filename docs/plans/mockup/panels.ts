import { main, state } from './model.ts';
import { escape, icon, icons } from './view.ts';

export type Pane = {
  id: string;
  label: string;
  content: (action: string) => string;
};

export function splitPanels(...panes: Pane[]) {
  const selected = focusedPane(panes);
  return workspace(
    'arc-grid equal',
    selected,
    panes.map((pane) => paneView(pane, selected)).join(''),
  );
}

export function standalonePane(pane: Pane, { before = '', after = '' } = {}) {
  const selected = focusedPane([pane]);
  return workspace(
    'arc-stack',
    selected,
    contextView(before) + paneView(pane, selected) + contextView(after),
  );
}

export function overview(
  metrics: string,
  outcome: string,
  { log, context }: { log?: Pane; context?: Pane | string },
) {
  const selected = focusedPane([log, typeof context === 'object' ? context : undefined]);
  return workspace(
    'arc-grid arc-index',
    selected,
    `<div class="arc-stack">
    ${contextView(metrics, 'arc-metrics-wrap')}
    ${log ? paneView(log, selected, 'arc-log-wrap') : ''}
  </div><div class="arc-stack">
    ${contextView(outcome, 'arc-outcome-wrap')}
    ${typeof context === 'object' ? paneView(context, selected, 'arc-context-wrap') : contextView(context, 'arc-context-wrap')}
  </div>`,
  );
}

function focusedPane(panes: (Pane | undefined)[]) {
  return panes.find((pane) => pane?.id === state.expandedPane)?.id;
}

function workspace(classes: string, selected: string | undefined, content: string) {
  return `<div class="${classes} arc-pane-workspace" ${selected ? 'data-expanded' : ''}>${content}</div>`;
}

function contextView(content = '', classes = '') {
  return content ? `<div class="${classes}" data-pane-context>${content}</div>` : '';
}

function paneView(pane: Pane, selected: string | undefined, classes = '') {
  return `<div class="${classes}" id="${pane.id}" data-pane-panel
    ${selected && pane.id !== selected ? 'hidden' : ''}>
    ${pane.content(expandButton(pane, pane.id === selected))}
  </div>`;
}

function expandButton(pane: Pane, expanded: boolean) {
  const name = expandLabel(pane.label, expanded);
  return `<button type="button" class="arc-link arc-pane-expand" data-expand-pane="${pane.id}"
    data-pane-label="${escape(pane.label)}" aria-controls="${pane.id}"
    aria-expanded="${expanded}" aria-label="${escape(name)}"
    data-arc-tooltip="${escape(name)}">${expandIcon(expanded)}</button>`;
}

function expandLabel(label: string, expanded: boolean) {
  return (expanded ? 'Collapse ' : 'Expand ') + label;
}

function expandIcon(expanded: boolean) {
  return icon(expanded ? 'minimize-2' : 'maximize-2');
}

export function togglePane(control: HTMLButtonElement) {
  const id = control.dataset.expandPane;
  if (!id) return;
  state.expandedPane = state.expandedPane === id ? null : id;
  main.querySelectorAll('.arc-pane-workspace').forEach(updateWorkspace);
  icons();
  control.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function updateWorkspace(workspace: Element) {
  const panes = [...workspace.querySelectorAll<HTMLElement>('[data-pane-panel]')];
  const selected = panes.find((pane) => pane.id === state.expandedPane);
  workspace.toggleAttribute('data-expanded', Boolean(selected));
  for (const pane of panes) {
    pane.hidden = Boolean(selected && pane !== selected);
    const control = pane.querySelector<HTMLButtonElement>('[data-expand-pane]');
    if (control) updateExpandButton(control, pane === selected);
  }
}

function updateExpandButton(control: HTMLButtonElement, expanded: boolean) {
  const paneLabel = control.dataset.paneLabel;
  if (!paneLabel || control.getAttribute('aria-expanded') === String(expanded)) return;
  const name = expandLabel(paneLabel, expanded);
  control.setAttribute('aria-expanded', String(expanded));
  control.setAttribute('aria-label', name);
  control.dataset.arcTooltip = name;
  control.innerHTML = expandIcon(expanded);
}
