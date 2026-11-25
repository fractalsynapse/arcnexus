import { createElement as h } from 'react';
import { PlannerMetrics, type PlanMetrics } from './planner-metrics.js';
import { PlannerOutcome } from './planner-outcome.js';
import { useResource } from './resource.js';
import { usePlanResource, type PlanOutcome } from './plan-resource.js';

type PlanReadout = 'outcome' | 'metrics';

/** Mount one Plan projection against the stable execution selected for the current project. */
export function PlanDisplay({ kind }: { kind: PlanReadout }) {
  const { project, history, execution, plan, refresh } = usePlanResource();
  const result = useResource<PlanOutcome & PlanMetrics>(plan && plan + '/' + kind, refresh);
  const unavailable = history.error ?? result.error;
  if (!project) return h('p', null, 'Select a project to view Planner ' + kind + '.');
  if (unavailable) return h('p', { role: 'alert' }, unavailable);
  if (history.value && !execution) return h('p', null, 'No recorded planning execution.');
  if (!result.value || !plan) return h('p', { role: 'status' }, 'Loading Planner ' + kind + '…');
  return kind === 'outcome'
    ? h(PlannerOutcome, { value: result.value, remote: project.remote })
    : h(PlannerMetrics, { value: result.value, path: plan + '/tool-counts' });
}
