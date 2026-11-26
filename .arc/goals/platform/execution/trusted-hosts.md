---
id: trusted-hosts
priority: 260
---

# Run projects on qualified, pinned execution environments

Execute projects only on approved environments enforcing captured filesystem, network, operation and credential boundaries. Environments unable to enforce required confinement remain unavailable.

Validate local build inputs or resolve registry images to immutable identities for the target platform. Qualify the environment and retain image, base and relevant tool identities in admission and evidence-reuse decisions. Installed tools grant no operation permission.

Preserve repositories, checkpoints, evidence and refreshed provider credentials across replacement, isolating credentials from project content and evidence. New images apply to new work after the project lane clears. Interrupted work uses its captured image unless authorized adoption changes it.

## Success measures

- Real model and check paths demonstrate confinement, cancellation, secret isolation and restart.
- Moving tags and changed build inputs cannot silently replace approved environments.
- Missing captured images produce explicit prerequisites.
- Derivative tools require authorized bindings, and environment changes refresh affected checks.
