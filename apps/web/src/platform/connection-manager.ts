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
  return h(DialogButton, {
    icon: 'computer',
    title: 'Connection manager',
    children: h(OperatorGate, { children: h(Connections) }),
  });
}

function Connections() {
  const { result, error, code, change } = useProviders();
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(
      'ul',
      { className: 'arc-management-list', 'aria-label': 'Capacity providers' },
      result.value
        ?.filter(({ state }) => state !== 'revoked')
        .map((provider) => providerRow(provider, () => void change(provider))),
    ),
    h(LauncherSetup, { code, issue: () => void change() }),
    (error || result.error) && h('p', { role: 'alert' }, error || result.error),
  );
}

function useProviders() {
  const { token } = usePlatformSession();
  const [refresh, reload] = useState(0);
  const [code, setCode] = useState('');
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
        setCode((await api<{ code: string }>(root + '/codes', token!, { method: 'POST' })).code);
      showError('');
      reload((index) => index + 1);
    } catch (error) {
      showError((error as Error).message);
    }
  };
  return { result, error, code, change };
}

function providerRow(provider: Provider, act: () => void) {
  const pending = provider.state === 'pending';
  return h(ManagementRow, {
    key: provider.id,
    title: provider.name,
    detail: provider.platform,
    status: pending
      ? { label: 'Pending admission', tone: 'pending' }
      : provider.online
        ? { label: 'Online', tone: 'positive' }
        : { label: 'Offline', tone: 'neutral' },
    action: h(Button, { onClick: act }, pending ? 'Admit' : 'Revoke'),
  });
}
