import {
  createContext,
  createElement as h,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { PropsWithChildren } from 'react';
import type { PlanReference } from '../../../../packages/coordination/src/postgres/plan-records.js';
import type { RecommendationAssessment } from '../../../../packages/planner/src/objective-review.js';
import type { Proposal } from '../../../../packages/planner/src/proposal.js';
import type { CommandBinding, CommandState } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';
import { usePlanChanges } from './plan-changes.js';

export interface PlanOutcome {
  active: boolean;
  report?: Proposal;
  recommendation?: RecommendationAssessment;
  changedPaths?: readonly string[];
  issue?: string;
  pull?: { url: string; state?: string } | null;
  outcome?: { kind?: string; commit?: string; summary?: string; reason?: string } | null;
}

const planScope = createContext<ReturnType<typeof usePlanSelection> | undefined>(undefined);

/** Reset the run selection when the operator switches projects. */
export function PlanScope({ binding, children }: PropsWithChildren<{ binding: CommandBinding }>) {
  const { project } = usePlatformSession();
  return h(PlanSelection, { key: project?.id, binding }, children);
}

function PlanSelection({ binding, children }: PropsWithChildren<{ binding: CommandBinding }>) {
  return h(planScope.Provider, { value: usePlanSelection(binding) }, children);
}

/** Share one run reference across independently loaded displays. */
export function usePlanResource() {
  const scope = useContext(planScope);
  if (!scope) throw new Error('Plan display requires its workspace scope');
  return scope;
}

function usePlanSelection(binding: CommandBinding) {
  const { project } = usePlatformSession();
  const command = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const choice = usePlanRunChoice(command);
  const root = project && '/projects/' + encodeURIComponent(project.id);
  const plans = root && root + '/plan-executions';
  const { history, updates, refresh } = usePlanHistory(plans, command);
  const entries = history.value?.entries;
  const view = selectPlanView(plans, command, entries, choice.selected);
  return {
    project,
    root,
    plans,
    history,
    entries,
    ...choice,
    ...view,
    command,
    updates,
    refresh: view.active ? refresh : (view.recorded?.updatedAt ?? undefined),
  };
}

function selectPlanView(
  plans: string | undefined,
  command: CommandState,
  entries: PlanReference[] | undefined,
  selected: string,
) {
  const running = runningPlan(command);
  const execution = selected || running || entries?.[0]?.execution;
  const recorded = entries?.find((entry) => entry.execution === execution);
  const preparing =
    !selected &&
    command.command === 'Plan' &&
    command.status === 'Active' &&
    (!running || !recorded?.active);
  const active = Boolean(recorded?.active || (execution && execution === running));
  const events =
    !preparing && plans && execution ? plans + '/' + encodeURIComponent(execution) : undefined;
  return { execution, recorded, active, events, plan: recorded ? events : undefined };
}

function usePlanRunChoice(command: CommandState) {
  const [selected, select] = useState('');
  useEffect(() => {
    if (command.command === 'Plan' && command.canCancel) select('');
  }, [command.command, command.canCancel, command.requestId]);
  return { selected, select };
}

function usePlanHistory(plans: string | undefined, command: CommandState) {
  const updates = usePlanChanges(plans);
  const receipt =
    command.command === 'Plan'
      ? [command.requestId, command.execution, command.status].join(':')
      : '';
  const refresh = receipt + ':' + updates.epoch;
  return { history: useResource<{ entries: PlanReference[] }>(plans, refresh), updates, refresh };
}

function runningPlan(command: CommandState) {
  return command.command === 'Plan' && command.canCancel ? command.execution : undefined;
}
