import { createElement as h } from 'react';
import { Tabs, type TabSection } from '../controls/tabs.js';

/** Keep an agent's summary and structured findings readable in the outcome panel. */
export function AgentReport({
  summary,
  sections,
  label,
}: {
  summary: string;
  sections: readonly TabSection[];
  label: string;
}) {
  return h(
    'div',
    { className: 'arc-agent-report' },
    h('p', { className: 'arc-agent-summary' }, summary),
    h(Tabs, { label, sections }),
  );
}
