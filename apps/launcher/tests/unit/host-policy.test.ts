import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { matchesHostPolicy, withHostPolicy } from '../../src/host-policy.js';

export const suite = { owner: 'launcher-app', level: 'unit', tags: ['host'] } as const;

/** Model the Docker inspect response after its CLI reads the generated filter. */
function capturePolicy() {
  return withHostPolicy(async (args) => {
    const options = args
      .filter((argument) => argument.startsWith('--security-opt='))
      .map((argument) => argument.slice('--security-opt='.length));
    const path = options.find((option) => option.startsWith('seccomp='))!.slice('seccomp='.length);
    return {
      path,
      config: {
        AppArmorProfile: 'arcnexus-host',
        Config: { User: args.find((argument) => argument.startsWith('--user='))!.slice(7) },
        HostConfig: {
          Privileged: false,
          CapAdd: [],
          MaskedPaths: [],
          ReadonlyPaths: [],
          CapDrop: args
            .filter((argument) => argument.startsWith('--cap-drop='))
            .map((argument) => argument.slice(11)),
          SecurityOpt: options
            .filter((option) => option !== 'systempaths=unconfined')
            .map((option) =>
              option.startsWith('seccomp=') ? 'seccomp=' + readFileSync(path, 'utf8') : option,
            ),
        },
      },
    };
  });
}

test('Docker receives the bundled Host policy and reuse refuses broader settings', async () => {
  const profile = await capturePolicy();
  assert.equal(existsSync(profile.path), false);
  assert.equal(matchesHostPolicy(profile.config), true);
  const settings = profile.config.HostConfig;
  assert.equal(
    matchesHostPolicy({ ...profile.config, HostConfig: { ...settings, CapAdd: ['SYS_ADMIN'] } }),
    false,
  );
  assert.equal(
    matchesHostPolicy({
      ...profile.config,
      HostConfig: { ...settings, SecurityOpt: [...settings.SecurityOpt, 'seccomp=unconfined'] },
    }),
    false,
  );
});
