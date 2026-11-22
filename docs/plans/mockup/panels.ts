import { state } from './model.ts';
import { escape, icon, icons } from './view.ts';

type Pane = {
  id: string;
  label: string;
  content: (action: string) => string;
};

export function splitPanels(...panes: Pane[]) {
  const selected = panes.find((pane) => pane.id === state.expandedPane);
  return `<div class="arc-grid equal arc-pane-workspace" ${selected ? 'data-expanded' : ''}>
    ${panes
      .map(
        (pane) => `<div id="${pane.id}" data-pane-panel
      ${selected && pane !== selected ? 'hidden' : ''}>
      ${pane.content(expandButton(pane, pane === selected))}
    </div>`,
      )
      .join('')}
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
  const { expandPane: id, paneLabel } = control.dataset;
  const workspace = control.closest('.arc-pane-workspace');
  if (!workspace || !id || !paneLabel) return;
  const expanded = state.expandedPane !== id;
  state.expandedPane = expanded ? id : null;
  workspace.toggleAttribute('data-expanded', expanded);
  workspace.querySelectorAll<HTMLElement>('[data-pane-panel]').forEach((pane) => {
    pane.hidden = expanded && pane.id !== id;
  });
  const name = expandLabel(paneLabel, expanded);
  control.setAttribute('aria-expanded', String(expanded));
  control.setAttribute('aria-label', name);
  control.dataset.arcTooltip = name;
  control.innerHTML = expandIcon(expanded);
  icons();
}
