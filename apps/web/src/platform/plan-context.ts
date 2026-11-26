import { createElement as h } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';
import { ActiveProject } from './active-project.js';
import { usePlanResource } from './plan-resource.js';

/** Give the selected Plan its recording time beside the workspace title. */
export function PlanContext() {
  const { recorded, updates, active } = usePlanResource();
  return h(
    'span',
    { className: 'arc-platform-inline', role: 'status' },
    h(ActiveProject),
    recorded?.startedAt &&
      h(
        'time',
        { dateTime: recorded.startedAt },
        'Started ',
        new Date(recorded.startedAt).toLocaleString(),
      ),
    active
      ? 'Active'
      : recorded?.updatedAt &&
          h(
            'time',
            { dateTime: recorded.updatedAt },
            'Ended ' + new Date(recorded.updatedAt).toLocaleTimeString(),
          ),
    active &&
      updates.disconnected &&
      h(Button, { onClick: updates.reconnect }, 'Reconnect live updates'),
  );
}
