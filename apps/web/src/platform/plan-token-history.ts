import { createElement as h, useEffect, useState } from 'react';
import {
  TokenHistory,
  type RunTokenReport,
  type TokenUsage,
} from '../../../../packages/ui/src/index.js';
import type { PlanReference } from '../../../../packages/coordination/src/postgres/plan-records.js';
import { useBrowserPlatform } from './browser-platform.js';
import type { GatewayClient } from './gateway-client.js';
import { usePlanResource } from './plan-resource.js';
import { planRunLabel } from './recorded-time.js';

/** Read the active project's retained runs only while the details are open. */
export function PlanTokenHistory() {
  const { entries, plans } = usePlanResource();
  if (!plans || !entries?.length) return h('p', null, 'No recorded Plan runs.');
  const key = JSON.stringify(
    entries.map(({ execution, attempt, active }) => [execution, attempt, active]),
  );
  return h(PlanTokenReports, { key, path: plans, entries });
}

function PlanTokenReports({ path, entries }: { path: string; entries: readonly PlanReference[] }) {
  const { gateway } = useBrowserPlatform();
  const [runs] = useState(entries);
  const [reports, setReports] = useState<RunTokenReport[]>();
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(
      runs.map(({ execution, startedAt }, index) => {
        const label = planRunLabel(startedAt, runs.length - index);
        return runReport(gateway, path, { id: execution, label }, controller.signal);
      }),
    ).then((result) => {
      if (!controller.signal.aborted) setReports(result);
    });
    return () => controller.abort();
  }, [gateway, path, runs]);
  if (!reports) return h('p', { role: 'status' }, 'Loading Plan run usage…');
  return h(TokenHistory, { label: 'Plan run token usage', runs: reports });
}

async function runReport(
  gateway: GatewayClient,
  path: string,
  run: RunTokenReport,
  signal: AbortSignal,
) {
  try {
    const resource = path + '/' + encodeURIComponent(run.id) + '/token-history';
    const { samples } = await gateway.read<{ samples: TokenUsage[] }>(resource, { signal });
    const report = samples.at(-1);
    return { ...run, input: report?.input, output: report?.output };
  } catch {
    return { ...run, unavailable: true };
  }
}
