import { createElement as h } from 'react';
import { DialogButton, JsonView } from '../../../../packages/ui/src/index.js';
import { OperationDetail } from './operation-detail.js';
import { EventActivity } from './event-activity.js';
import type { Operation } from './timeline-groups.js';

/** Show the recorded result inline and leave the complete payload on demand. */
export function OperationRow({ entry, execution }: { entry: Operation; execution?: string }) {
  const { check, state, tool, label, sequence, actor } = entry;
  const result = operationState(entry);
  return h(
    'li',
    { className: 'arc-timeline-operation', 'data-operation-state': result.tone },
    h('code', null, label),
    actor && h(EventActivity, { actor }),
    h('small', null, result.label),
    execution && tool && h(OperationDetail, { sequence, execution, operation: tool, phase: state }),
    check &&
      h(DialogButton, {
        icon: 'info',
        title: label + ' check details',
        children: h(JsonView, { value: check }),
      }),
  );
}

function operationState({ check, state }: Operation) {
  if (check)
    return {
      tone: check.status === 0 ? 'passed' : typeof check.status === 'number' ? 'failed' : undefined,
      label: checkState(check.status),
    };
  if (state === 'completed') return { tone: 'passed', label: 'Completed' };
  if (state === 'failed' || state === 'refused' || state === 'cancelled')
    return { tone: 'failed', label: state.charAt(0).toUpperCase() + state.slice(1) };
  return {
    label:
      state === 'started' || state === 'in_progress'
        ? 'In progress'
        : (state ?? 'Status unavailable'),
  };
}

function checkState(status?: number | string) {
  if (status === 0) return 'Passed';
  if (typeof status === 'number') return 'Failed (exit ' + status + ')';
  if (status === 'not-applicable') return 'Not applicable';
  return status ?? 'Status unavailable';
}
