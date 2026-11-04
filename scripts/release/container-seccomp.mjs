import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const revision = '6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef';

const expected = '6416b47770785a41ac59073cdc77d9fe98517df2799dc83ef207e622de3053f6';

/** Generates the deployment policy from a pinned upstream baseline without weakening unrelated syscall denials. */
class ContainerSeccomp {
  /** Fetches immutable policy bytes, verifies their digest and writes only the explicitly requested output file. */
  async run(output) {
    if (!output) throw new Error('Usage: node scripts/release/container-seccomp.mjs <output.json>');
    const url = `https://raw.githubusercontent.com/moby/profiles/${revision}/seccomp/default.json`;
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) throw new Error('Cannot read pinned Moby seccomp policy: ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== expected)
      throw new Error('Pinned container seccomp source digest mismatch');
    const profile = JSON.parse(bytes.toString('utf8'));
    if (profile.defaultAction !== 'SCMP_ACT_ERRNO' || !Array.isArray(profile.syscalls))
      throw new Error('Unexpected default container policy');
    profile.syscalls.push({
      names: ['unshare', 'clone', 'mount', 'umount2', 'pivot_root', 'setns'],
      action: 'SCMP_ACT_ALLOW',
      args: [],
    });
    writeFileSync(output, JSON.stringify(profile, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
}

new ContainerSeccomp().run(process.argv[2]).catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
