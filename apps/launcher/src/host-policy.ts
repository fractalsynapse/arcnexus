import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mobyDefault from '../policy/moby-default.json' with { type: 'json' };
import { textDigest } from '../../../packages/foundation/src/index.js';

const namespaceFlags = 0x7e020000;
const codexFilesystemNamespaces = 0x78020000;
const newUserNamespace = 0x10000000;
const sharedOrMoveMount = 0x102000; // MS_SHARED | MS_MOVE

/** Keep Docker's default allowlist and add only Bubblewrap's sandbox setup calls. */
export const hostSeccomp = {
  ...mobyDefault,
  syscalls: [
    ...mobyDefault.syscalls,
    ...[namespaceFlags, codexFilesystemNamespaces].map((namespaces) => ({
      names: ['clone'],
      action: 'SCMP_ACT_ALLOW',
      args: [
        {
          index: 0,
          value: namespaceFlags,
          valueTwo: namespaces,
          op: 'SCMP_CMP_MASKED_EQ',
        },
      ],
    })),
    {
      names: ['unshare'],
      action: 'SCMP_ACT_ALLOW',
      args: [{ index: 0, value: newUserNamespace, op: 'SCMP_CMP_EQ' }],
    },
    {
      names: ['mount'],
      action: 'SCMP_ACT_ALLOW',
      args: [{ index: 3, value: sharedOrMoveMount, valueTwo: 0, op: 'SCMP_CMP_MASKED_EQ' }],
    },
    {
      names: ['pivot_root'],
      action: 'SCMP_ACT_ALLOW',
    },
    {
      names: ['umount2'],
      action: 'SCMP_ACT_ALLOW',
      args: [{ index: 1, value: 2, op: 'SCMP_CMP_EQ' }], // MNT_DETACH
    },
    // Use Bubblewrap's mount(2) fallback so AppArmor mediates the remounts.
    { names: ['mount_setattr'], action: 'SCMP_ACT_ERRNO', errnoRet: 38 },
  ],
};

const appArmorProfile = 'arcnexus-host';
const user = 'node';
const seccomp = JSON.stringify(hostSeccomp);
const securityOptions = ['no-new-privileges=true', 'apparmor=' + appArmorProfile];
// A fresh procfs mount requires replacing Docker's masks with the AppArmor rules.
const systemPathsOption = 'systempaths=unconfined';
const expectedSecurityOptions = [...securityOptions, 'seccomp=' + seccomp];
export const hostPolicyIdentity = textDigest(
  JSON.stringify([user, [...securityOptions, systemPathsOption, 'seccomp=' + seccomp]]),
);

export function matchesHostPolicy(config: {
  AppArmorProfile: string;
  Config: { User: string };
  HostConfig: {
    Privileged: boolean;
    CapAdd: string[] | null;
    CapDrop: string[] | null;
    SecurityOpt: string[] | null;
    MaskedPaths: string[];
    ReadonlyPaths: string[];
  };
}) {
  const { Privileged, CapAdd, CapDrop, SecurityOpt, MaskedPaths, ReadonlyPaths } =
    config.HostConfig;
  const applied = SecurityOpt?.filter((option) => option !== systemPathsOption);
  return (
    !Privileged &&
    !CapAdd?.length &&
    CapDrop?.includes('ALL') === true &&
    config.Config.User === user &&
    config.AppArmorProfile === appArmorProfile &&
    MaskedPaths?.length === 0 &&
    ReadonlyPaths?.length === 0 &&
    applied?.length === expectedSecurityOptions.length &&
    expectedSecurityOptions.every((option) => applied.includes(option))
  );
}

/** Materialize the bundled filter only for Docker CLI to send it to the engine. */
export async function withHostPolicy<T>(run: (args: string[]) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), 'arc-host-policy-'));
  const file = join(directory, 'seccomp.json');
  try {
    await writeFile(file, seccomp, { mode: 0o600 });
    return await run([
      '--user=' + user,
      '--cap-drop=ALL',
      ...securityOptions.map((option) => '--security-opt=' + option),
      '--security-opt=' + systemPathsOption,
      '--security-opt=seccomp=' + file,
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
