---
id: "trusted-hosts"
---

# Run projects on qualified, pinned execution environments

Execute projects only on approved environments that enforce captured filesystem, network, operation and credential boundaries. An environment that cannot enforce required confinement remains unavailable.

Validate local build inputs or resolve registry images to immutable identities for the target platform. Qualify the resulting environment and retain its image, base and tool identities in admission and evidence reuse decisions. Tool availability does not grant operation permission.

Keep repositories, checkpoints, evidence and refreshed provider credentials recoverable across replacement, with credentials isolated from project content and evidence. New images apply to new work after the project lane is clear. Interrupted work resumes on its captured image unless an authorized adoption changes that requirement.

## Observable success

- Real model and check paths demonstrate confinement, cancellation, secret isolation and restart.
- Moving tags or changing build inputs cannot silently replace an approved environment.
- Missing captured images produce explicit prerequisites.
- Derivative tools are available only through authorized bindings, and changed environments refresh affected checks.