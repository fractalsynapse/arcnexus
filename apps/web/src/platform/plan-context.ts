import { createElement as h } from 'react';
import type { CommandBinding } from '../../../../packages/ui/src/index.js';
import { usePlanResource } from './plan-resource.js';
import { projectName } from './session.js';

/** Give the selected Plan its recording time beside the workspace title. */
export function PlanContext({ binding }: { binding: CommandBinding }) {
  const { project, current } = usePlanResource(binding);
  if (!project) return h('span', { role: 'status' }, 'No active project');
  const recorded = current.value;
  return h(
    'span',
    { className: 'arc-platform-inline', role: 'status' },
    projectName(project),
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
