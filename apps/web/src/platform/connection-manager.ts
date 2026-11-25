import { isLauncherTarget, launcherTargets } from '../../../launcher/src/targets.js';
import { LauncherSetup } from './launcher-setup.js';
import { createElement as h, useState } from 'react';
import { Button, DialogButton, ManagementRow } from '../../../../packages/ui/src/index.js';
import { OperatorGate } from './operator-gate.js';
import { api, useResource } from './resource.js';
import { usePlatformSession } from './session.js';

interface Provider {
  id: string;
  name: string;
  platform: string;
  state: 'pending' | 'admitted' | 'revoked';
  online: boolean;
}

export function ConnectionManager() {
  const { token } = usePlatformSession();
  const [registration, setRegistration] = useState<{ token: string; value: string }>();
  return h(DialogButton, {
    icon: 'computer',
    title: 'Connection manager',
    children: h(OperatorGate, {
      children: h(Connections, {
        code: registration?.token === token ? registration?.value : undefined,
        onCode: (value) => {
          if (token) setRegistration({ token, value });
        },
      }),
    }),
  });
}

interface ConnectionsProps {
  code?: string;
  onCode(value: string): void;
}

function Connections({ code, onCode }: ConnectionsProps) {
  const { result, error, change } = useProviders(onCode);
  const providers = result.value?.filter(({ state }) => state !== 'revoked');
  return h(
    'div',
    { className: 'arc-platform-stack' },
    providers && h(ProviderList, { providers, act: (provider) => void change(provider) }),
    h(LauncherSetup, { code, issue: () => void change() }),
    (error || result.error) && h('p', { role: 'alert' }, error || result.error),
  );
}

function ProviderList({
  providers,
  act,
}: {
  providers: Provider[];
  act(provider: Provider): void;
}) {
  if (!providers.length) return h('p', null, 'No capacity providers connected.');
  return h(
    'ul',
    { className: 'arc-management-list', 'aria-label': 'Capacity providers' },
    providers.map((provider) => providerRow(provider, () => act(provider))),
  );
}

function useProviders(onCode: ConnectionsProps['onCode']) {
  const { token } = usePlatformSession();
  const [refresh, reload] = useState(0);
  const [error, showError] = useState('');
  const root = '/capacity-providers';
  const result = useResource<Provider[]>(root, token, refresh);
  const change = async (provider?: Provider) => {
    try {
      if (provider) {
        await api(root + '/' + provider.id, token!, {
          method: 'PATCH',
          body: JSON.stringify({ state: provider.state === 'pending' ? 'admitted' : 'revoked' }),
        });
      } else
        onCode((await api<{ code: string }>(root + '/codes', token!, { method: 'POST' })).code);
      showError('');
      reload((index) => index + 1);
    } catch (error) {
      showError((error as Error).message);
    }
  };
  return { result, error, change };
}

function providerRow(provider: Provider, act: () => void) {
  const pending = provider.state === 'pending';
  const action = pending ? 'Admit' : 'Revoke';
  return h(ManagementRow, {
    key: provider.id,
    title: provider.name,
    detail: isLauncherTarget(provider.platform)
      ? launcherTargets[provider.platform]
      : provider.platform,
    status: pending
      ? { label: 'Pending admission', tone: 'pending' }
      : provider.online
        ? { label: 'Online', tone: 'positive' }
        : { label: 'Offline', tone: 'neutral' },
    action: h(Button, { 'aria-label': action + ' ' + provider.name, onClick: act }, action),
  });
}
