import { createElement as h, useEffect, useState } from 'react';
import { Button, SelectField } from '../../../../packages/ui/src/index.js';

const targets = [
  { value: '', label: 'Choose operating system and CPU' },
  { value: 'linux-x64', label: 'Linux · x64' },
  { value: 'linux-arm64', label: 'Linux · ARM64' },
  { value: 'macos-x64', label: 'macOS · x64' },
  { value: 'macos-arm64', label: 'macOS · ARM64' },
  { value: 'windows-x64', label: 'Windows · x64' },
  { value: 'windows-arm64', label: 'Windows · ARM64' },
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
    h(
      'div',
      { className: 'arc-platform-inline' },
      h(Button, { disabled: true }, 'Download launcher'),
      h('small', null, 'A launcher download is unavailable for this deployment.'),
    ),
    h(Button, { onClick: issue }, 'Create registration code'),
    code &&
      h(
        'div',
        { className: 'arc-platform-code' },
        h('span', null, 'Registration code'),
        h('code', null, code),
      ),
  );
}
