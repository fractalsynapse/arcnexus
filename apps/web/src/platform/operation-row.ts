import { createElement as h } from 'react';
import { DialogButton, JsonView } from '../../../../packages/ui/src/index.js';
import { OperationDetail } from './operation-detail.js';
import type { Operation } from './timeline-groups.js';

/** Show the recorded result inline and leave the complete payload on demand. */
export function OperationRow({ entry, execution }: { entry: Operation; execution?: string }) {
  const { check, state, tool, label, sequence } = entry;
  return h(
    'li',
    { className: 'arc-timeline-operation' },
    h('code', null, label),
    check &&
      h(
        'span',
        { 'data-check-state': check.status === 0 ? 'passed' : 'other' },
        checkState(check.status),
      ),
    !check && state && h('small', null, state),
    execution && tool && h(OperationDetail, { sequence, execution, operation: tool }),
    check &&
      h(DialogButton, {
        icon: 'info',
        title: label + ' check details',
        children: h(JsonView, { value: check }),
      }),
  );
}

function checkState(status?: number | string) {
  if (status === 0) return 'Passed';
  if (typeof status === 'number') return 'Failed (exit ' + status + ')';
  if (status === 'not-applicable') return 'Not applicable';
  return status ?? 'Status unavailable';
}
