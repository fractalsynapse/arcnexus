import { createElement as h } from 'react';
import type { ReactNode } from 'react';

interface ManagementRowProps {
  title: ReactNode;
  detail?: ReactNode;
  status?: { label: string; tone: 'positive' | 'neutral' | 'pending' };
  action: ReactNode;
}

/** Render a compact record with an accessible status and management action. */
export function ManagementRow({ title, detail, status, action }: ManagementRowProps) {
  return h(
    'li',
    { className: 'arc-management-row' },
    h(
      'div',
      { className: 'arc-management-record' },
      h('strong', null, title),
      detail && h('small', null, detail),
      status &&
        h('span', { className: 'arc-management-status', 'data-tone': status.tone }, status.label),
    ),
    action,
  );
}
