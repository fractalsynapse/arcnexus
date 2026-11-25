import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';

interface PlanReference {
  execution: string | null;
  revision: string | null;
  active: boolean;
  startedAt?: string | null;
  updatedAt?: string | null;
}

export interface PlanOutcome {
  active: boolean;
  changedPaths?: readonly string[];
  issue?: string;
  pull?: { url: string; state?: string };
  outcome?: { kind?: string; commit?: string; summary?: string; reason?: string } | null;
}

/** Resolve the selected project and the shared small Plan execution reference. */
export function usePlanResource(binding: CommandBinding) {
  const { project, token } = usePlatformSession();
  const command = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const refresh = command.command === 'Plan' ? [command.execution, command.status].join(':') : '';
  const root = project && '/projects/' + encodeURIComponent(project.id);
  const plans = root && root + '/plan-executions/';
  const current = useResource<PlanReference>(plans && plans + 'current', token, refresh);
  const execution = current.value?.execution;
  const plan = plans && execution ? plans + encodeURIComponent(execution) : undefined;
  return { project, token, root, current, execution, plan, command, refresh };
}
import { useSyncExternalStore } from 'react';
import type { CommandBinding } from '../../../../packages/ui/src/index.js';
