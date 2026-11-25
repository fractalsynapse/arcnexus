import { createElement as h } from 'react';
import { ActiveProject } from './active-project.js';
import { usePlanResource } from './plan-resource.js';

/** Give the selected Plan its recording time beside the workspace title. */
export function PlanContext() {
  const { recorded } = usePlanResource();
  return h(
    'span',
    { className: 'arc-platform-inline', role: 'status' },
    h(ActiveProject),
    recorded?.startedAt &&
      h('time', { dateTime: recorded.startedAt }, new Date(recorded.startedAt).toLocaleString()),
    recorded?.active
      ? 'Active'
      : recorded?.updatedAt &&
          h(
            'time',
            { dateTime: recorded.updatedAt },
            '– ' + new Date(recorded.updatedAt).toLocaleTimeString(),
          ),
  );
}
