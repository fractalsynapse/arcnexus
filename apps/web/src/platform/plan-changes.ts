import { useEffect, useState } from 'react';
import { followGatewayEvents } from './gateway-events.js';
import { useBrowserPlatform } from './browser-platform.js';
import type { GatewayClient } from './gateway-client.js';

/** Share one project notice stream among the independently mounted Plan reads. */
export function usePlanChanges(path?: string) {
  const { gateway } = useBrowserPlatform();
  const [epoch, tick] = useState(0);
  const [retry, reconnect] = useState(0);
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    if (!path) return;
    return followPlanChanges(
      gateway,
      path,
      () => {
        setFailed(undefined);
        tick((value) => value + 1);
      },
      () => setFailed(path),
    );
  }, [gateway, path, retry]);
  useEffect(() => {
    if (!path || failed !== path) return;
    const resume = () => reconnect((value) => value + 1);
    window.addEventListener('online', resume);
    return () => window.removeEventListener('online', resume);
  }, [path, failed]);
  return {
    epoch,
    disconnected: !!path && failed === path,
    reconnect: () => reconnect((value) => value + 1),
  };
}

function followPlanChanges(
  gateway: GatewayClient,
  path: string,
  receive: () => void,
  failed: () => void,
) {
  const lifetime = new AbortController();
  const disconnected = () => {
    if (!lifetime.signal.aborted) failed();
  };
  void followGatewayEvents(gateway, path, {
    kind: 'plan-change',
    signal: lifetime.signal,
    unavailable: 'Live Plan updates are unavailable.',
    receive,
  }).then(disconnected, disconnected);
  return () => lifetime.abort();
}
