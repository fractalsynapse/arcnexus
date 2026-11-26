import { createElement as h } from 'react';
import { Button, TimeRange } from '../../../../packages/ui/src/index.js';
import { ActiveProject } from './active-project.js';
import { usePlanResource } from './plan-resource.js';

/** Give the selected Plan its recording time beside the workspace title. */
export function PlanContext() {
  const { recorded, updates, active, command } = usePlanResource();
  return h(
    'span',
    { className: 'arc-platform-inline', role: 'status' },
    h(ActiveProject),
    h(TimeRange, { start: recorded?.startedAt, end: active ? undefined : recorded?.updatedAt }),
    active && h('span', null, command.status === 'Waiting' ? 'Awaiting review' : 'Active'),
    active &&
      updates.disconnected &&
      h(Button, { onClick: updates.reconnect }, 'Reconnect live updates'),
  );
}
