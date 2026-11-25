import { createElement as h } from 'react';
import { SelectField } from '../../../../packages/ui/src/index.js';
import { usePlanResource } from './plan-resource.js';

const startTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

/** Choose a retained execution without fetching any of its details in the heading. */
export function PlanRunSelector() {
  const { project, entries = [], selected, select, history } = usePlanResource();
  if (!project) return null;
  if (history.error) return h('small', { role: 'status' }, 'Run history unavailable');
  return h(SelectField<string>, {
    label: 'Plan run',
    value: selected,
    options: [
      { value: '', label: 'Latest run' },
      ...entries.map(({ execution, startedAt }, index) => ({
        value: execution,
        label: startedAt
          ? startTime.format(new Date(startedAt))
          : 'Run ' + (entries.length - index),
      })),
    ],
    onChange: select,
    hideLabel: true,
    className: 'arc-plan-run-selector',
  });
}
