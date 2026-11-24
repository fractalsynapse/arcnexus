import { createElement as h, useState } from 'react';
import { Button, DialogButton, ManagementRow } from '../../../../packages/ui/src/index.js';
import { LauncherSetup } from './launcher-setup.js';

type ProviderStatus = 'Online' | 'Offline' | 'Pending admission';
type Provider = { id: string; name: string; platform: string; status: ProviderStatus };

const providers: readonly Provider[] = [
  { id: 'desktop', name: 'Workstation', platform: 'Linux · x64', status: 'Online' },
  { id: 'server', name: 'Build host', platform: 'Linux · ARM64', status: 'Offline' },
  { id: 'laptop', name: 'Laptop', platform: 'macOS · ARM64', status: 'Pending admission' },
];

const tones = { Online: 'positive', Offline: 'neutral', 'Pending admission': 'pending' } as const;

/** Keep the preview provider lifecycle available when the manager is closed. */
export function ConnectionManager({ showProviders }: { showProviders: boolean }) {
  const [connections, setConnections] = useState<readonly Provider[]>(
    showProviders ? providers : [],
  );
  const act = (provider: Provider) =>
    setConnections((current) =>
      provider.status === 'Pending admission'
        ? current.map((item) => (item.id === provider.id ? { ...item, status: 'Online' } : item))
        : current.filter((item) => item.id !== provider.id),
    );
  return h(DialogButton, {
    icon: 'computer',
    title: 'Connection manager',
    children: h(
      'div',
      { className: 'arc-platform-stack' },
      connections.length
        ? h(
            'ul',
            { className: 'arc-management-list', 'aria-label': 'Capacity providers' },
            connections.map((provider) => providerRow(provider, () => act(provider))),
          )
        : h('p', null, 'No capacity providers connected.'),
      h(LauncherSetup),
    ),
  });
}

function providerRow(provider: Provider, act: () => void) {
  const action = provider.status === 'Pending admission' ? 'Admit' : 'Revoke';
  return h(ManagementRow, {
    key: provider.id,
    title: provider.name,
    detail: provider.platform,
    status: { label: provider.status, tone: tones[provider.status] },
    action: h(Button, { 'aria-label': action + ' ' + provider.name, onClick: act }, action),
  });
}
