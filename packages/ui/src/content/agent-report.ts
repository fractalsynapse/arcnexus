import { createElement as h } from 'react';
import type { ReactNode } from 'react';

export interface AgentReportSection {
  title: string;
  content: ReactNode;
}

/** Keep an agent's summary and structured findings readable in the outcome panel. */
export function AgentReport({
  summary,
  sections,
}: {
  summary: string;
  sections: readonly AgentReportSection[];
}) {
  return h(
    'div',
    { className: 'arc-agent-report' },
    h('p', { className: 'arc-agent-summary' }, summary),
    sections.map(({ title, content }) =>
      h('section', { key: title }, h('h3', null, title), content),
    ),
  );
}
