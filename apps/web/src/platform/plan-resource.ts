import {
  createContext,
  createElement as h,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react';
import type { PropsWithChildren } from 'react';
import type { PlanReference } from '../../../../packages/coordination/src/postgres/plan-records.js';
import type { CommandBinding, CommandState } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';

export interface PlanOutcome {
  active: boolean;
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
  const [selected, select] = useState('');
  const refresh = command.command === 'Plan' ? [command.execution, command.status].join(':') : '';
  const root = project && '/projects/' + encodeURIComponent(project.id);
  const plans = root && root + '/plan-executions';
  const history = useResource<{ entries: PlanReference[] }>(plans, refresh);
  const entries = history.value?.entries;
  const live = selected ? undefined : runningPlan(command);
  const execution = selected || live || entries?.[0]?.execution;
  const recorded = entries?.find((entry) => entry.execution === execution);
  const plan = plans && recorded ? plans + '/' + encodeURIComponent(recorded.execution) : undefined;
  const events = plan ?? (root && live && root + '/executions/' + encodeURIComponent(live));
  return {
    project,
    root,
    history,
    entries,
    selected,
    select,
    execution,
    recorded,
    plan,
    events,
    command,
    refresh: !selected || selected === command.execution ? refresh : undefined,
  };
}

function runningPlan(command: CommandState) {
  return command.command === 'Plan' && (command.status === 'Active' || command.status === 'Waiting')
    ? command.execution
    : undefined;
}
