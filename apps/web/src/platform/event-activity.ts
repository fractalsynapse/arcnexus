import { createElement as h } from 'react';
import type { ActivityAttribution } from './timeline-groups.js';

/** Name the component and activity captured for a timeline item. */
export function EventActivity({ actor }: { actor: ActivityAttribution }) {
  const { component, activity } = actor;
  return h('small', { className: 'arc-event-activity' }, title(component), ' · ', title(activity));
}

function title(value: string) {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (initial) => initial.toUpperCase());
}
