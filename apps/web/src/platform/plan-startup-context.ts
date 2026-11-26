import { createElement as h, Fragment, type ReactNode } from 'react';
import { ModelRequestView } from '../../../../packages/ui/src/index.js';
import type { ModelRequest } from '../../../../packages/foundation/src/model-request.js';
import { usePlanResource } from './plan-resource.js';
import { useResource } from './resource.js';

interface Capture {
  timestamp?: string | null;
  component?: string;
  activity?: string;
  request: ModelRequest;
}

/** Load startup evidence only when the Context tab is open. */
export function PlanStartupContext() {
  const { root, plan, recorded, refresh, history } = usePlanResource();
  const capture = useResource<Capture | null>(
    plan && plan + '/context',
    refresh,
    recorded?.attempt,
  );
  const hasNoCapture = capture.error || capture.value === null || (history.value && !recorded);
  const inspect = useResource<Capture & { placeholders: string[] }>(
    root && hasNoCapture && !capture.value
      ? root + '/inspection?component=planner&activity=planning'
      : undefined,
  );
  if (!root) return h('p', null, 'Select a project to inspect Planner context.');
  if (capture.value) return capturedRequest(capture.value);
  if (inspect.value) return inspectPreview(inspect.value);
  if (inspect.error || history.error)
    return h('p', { role: 'status' }, 'Planner context is unavailable.');
  return h('p', { role: 'status' }, 'Loading Planner context…');
}

function capturedRequest({ request, timestamp, component, activity }: Capture) {
  return contextCard(
    'Captured model request',
    h(
      'div',
      { className: 'arc-platform-inline' },
      [component, activity].filter(Boolean).join(' / '),
      timestamp && h('time', { dateTime: timestamp }, new Date(timestamp).toLocaleString()),
    ),
    request,
  );
}

function inspectPreview({ request, placeholders }: Capture & { placeholders: string[] }) {
  return contextCard(
    'Inspect preview',
    h(
      Fragment,
      null,
      h(
        'p',
        null,
        'Startup evidence is unavailable. This preview uses the project’s current revision.',
      ),
      !!placeholders.length &&
        h('small', null, 'Activation placeholders: ', placeholders.join(', ')),
    ),
    request,
  );
}

function contextCard(title: string, details: ReactNode, request: ModelRequest) {
  return h(
    'div',
    { className: 'arc-surface arc-context-view arc-platform-stack' },
    h('h2', null, title),
    details,
    h(ModelRequestView, { request }),
  );
}
