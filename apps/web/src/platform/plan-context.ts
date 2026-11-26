import { createElement as h } from 'react';
import { Button, LocalTime } from '../../../../packages/ui/src/index.js';
import { ActiveProject } from './active-project.js';
import { usePlanResource } from './plan-resource.js';

/** Give the selected Plan its recording time beside the workspace title. */
export function PlanContext() {
  const { recorded, updates, active } = usePlanResource();
  return h(
    'span',
    { className: 'arc-platform-inline', role: 'status' },
    h(ActiveProject),
    h(LocalTime, { timestamp: recorded?.startedAt, prefix: 'Started ', date: true }),
    active ? 'Active' : h(LocalTime, { timestamp: recorded?.updatedAt, prefix: 'Ended ' }),
    active &&
      updates.disconnected &&
      h(Button, { onClick: updates.reconnect }, 'Reconnect live updates'),
  );
}
