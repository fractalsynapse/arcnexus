import { createElement as h, useEffect, useState } from 'react';
import { launcherTargets, type LauncherBuild } from '../../../launcher/src/targets.js';
import { LauncherDownload } from './launcher-download.js';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';
import { Button, SelectField } from '../../../../packages/ui/src/index.js';

const targets = [
  { value: '', label: 'Choose operating system and CPU' },
  ...Object.entries(launcherTargets).map(([value, label]) => ({ value, label })),
];

type PlatformHints = { platform?: string; architecture?: string; bitness?: string };
type BrowserPlatform = Navigator & {
  userAgentData?: { getHighEntropyValues(names: string[]): Promise<PlatformHints> };
};

async function detectedTarget() {
  const hints = await (navigator as BrowserPlatform).userAgentData?.getHighEntropyValues([
    'platform',
    'architecture',
    'bitness',
  ]);
  if (hints?.bitness !== '64') return '';
  const os = hints.platform?.replace(/[^a-z]/gi, '').toLowerCase();
  const cpu = { x86: 'x64', arm: 'arm64' }[hints.architecture ?? ''];
  const target = os + '-' + cpu;
  return targets.some(({ value }) => value === target) ? target : '';
}

function useLauncherTarget() {
  const [target, select] = useState('');
  useEffect(() => {
    let mounted = true;
    void detectedTarget().then(
      (value) => {
        if (mounted) select((current) => current || value);
      },
      () => {},
    );
    return () => {
      mounted = false;
    };
  }, []);
  return [target, select] as const;
}

/** Pick a launcher target and display the operator-issued registration code. */
export function LauncherSetup({ code, issue }: { code?: string; issue(): void }) {
  const [target, select] = useLauncherTarget();
  const { token } = usePlatformSession();
  const builds = useResource<{ entries: LauncherBuild[] }>('/launcher-builds', token);
  const published = builds.value?.entries?.find((build) => build.target === target);
  return h(
    'section',
    { className: 'arc-platform-stack', 'aria-label': 'Launcher setup' },
    h('h3', null, 'Connect a provider'),
    h(SelectField<string>, {
      label: 'Launcher build',
      value: target,
      options: targets,
      onChange: select,
    }),
    h(LauncherActions, { published, issue, unavailable: !!target && !!builds.value && !published }),
    code &&
      h(
        'div',
        { className: 'arc-platform-code' },
        h('span', null, 'Registration code'),
        h('code', null, code),
      ),
  );
}

function LauncherActions({
  published,
  issue,
  unavailable,
}: {
  published?: LauncherBuild;
  issue(): void;
  unavailable: boolean;
}) {
  return h(
    'div',
    { className: 'arc-platform-inline' },
    h(LauncherDownload, { build: published }),
    h(Button, { onClick: issue }, 'Create registration code'),
    unavailable && h('small', null, 'No launcher build for this target.'),
  );
}
