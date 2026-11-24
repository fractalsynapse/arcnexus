import { createElement as h } from 'react';
import type { DisplayRegistration } from '../registry/workspace.js';

export function DisplayPanel({ panel, order }: { panel: DisplayRegistration; order: number }) {
  return h(
    'section',
    { className: 'arc-surface arc-display', style: { order } },
    h('h2', null, panel.label),
    panel.content,
  );
}
