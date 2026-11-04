# Container qualification

Status: native confinement and same-mount container replacement are qualified.
Real-agent qualification and relocation of unfinished execution checkpoints remain
open; this is not a claim that phase two or production release is complete.

The supervisor needs a writable, dedicated cgroup-v2 subtree to terminate managed
process trees, and an outer container policy that permits its nested Linux sandbox.
Application and supervising-runtime mounts remain read-only. Keep repository,
candidate, database and evidence state in the project volume. Worker filesystem
and network permissions still come from captured ArcNexus authority.

## Dedicated outer policy

[arcnexus.apparmor](../../docker/arcnexus.apparmor) is derived from Moby's container
profile at commit `6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef`. It preserves the system
path and network-family denials and permits the mount operations needed inside a
new user namespace. Use it only with **all capabilities dropped before application execution**, a read-only
root filesystem, read-only application/runtime mounts, private temporary storage
and a dedicated application cgroup subtree. Do not use `--privileged`, an unconfined
profile, a writable mount of all host cgroups, or the Docker socket in the container.

An administrator can load the separate profile without replacing `docker-default`:

```sh
sudo apparmor_parser --replace docker/arcnexus.apparmor
```

Generate the companion seccomp policy outside maintained source:

```sh
node scripts/release/container-seccomp.mjs /tmp/arcnexus-seccomp.json
```

The generator verifies the exact upstream content digest before retaining its
existing restrictions and adding only the nested namespace/mount syscall set.
It refuses to overwrite an existing output. The upstream license is retained in
[docker/LICENSE.moby.txt](../../docker/LICENSE.moby.txt).

Select these through Docker's `--security-opt apparmor=arcnexus-container` and
`--security-opt seccomp=/tmp/arcnexus-seccomp.json` options. Kernel capability checks
still apply inside and outside user namespaces. Syntax parsing is not enforcement
qualification: source-write prevention, network bypass rejection, parent-death
cleanup and retained-volume recovery must all be demonstrated with these options.

## Observed evidence

On Docker 29.9.1 with the systemd cgroup driver, an isolated `arcnexusq148.slice`
subtree passed all three native process-scope tests inside the container. No other
host cgroup subtree was writable. The temporary containers were removed afterward.

The default Docker policy failed Bubblewrap namespace creation. Adding the pinned
seccomp policy allowed user-namespace creation, but `docker-default` then rejected
mount propagation. The dedicated AppArmor profile parses on AppArmor 5.0.2; loading
it required administrator authentication. The later enforcement result appears below.
These results establish the prerequisites of these specific configurations, not a
universal container limitation. Detailed commands and logs are retained with the
phase-two development evidence.

Primary contracts: [Docker container options](https://docs.docker.com/reference/cli/docker/container/run/),
[Docker seccomp](https://docs.docker.com/engine/security/seccomp/), and
[Moby's pinned policies](https://github.com/moby/profiles/tree/6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef).

## Runtime identity and observed enforcement

The qualified runtime executes as a nonzero UID/GID with no effective, permitted,
inheritable, ambient or bounding capabilities, and with no-new-privileges enabled.
Running UID 0 with an empty capability set fails the kernel's user-namespace UID
mapping rules. [The kernel interface](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
requires CAP_SETFCAP when mapping parent UID 0; do not grant this to engineering.

[entrypoint.sh](../../docker/entrypoint.sh) supports an already delegated non-root
runtime. For Docker's root-owned cgroup, its root-only startup path needs CHOWN,
SETUID, SETGID and SETPCAP solely to delegate the current container's cgroup and
irreversibly drop identity and capabilities. Set `ARCNEXUS_CGROUP_ROOT` to the
canonical dedicated mounted parent and optionally `ARCNEXUS_UID`/`ARCNEXUS_GID`
(default 1000). It never changes the parent, host cgroup root, source or volume
ownership. Supply an already accessible project volume. The application and all
project commands start only after `setpriv` drops the complete bounding set.
Never add SYS_ADMIN or SETFCAP. The AppArmor profile requires `pivot_root` as well
as `mount` for the inner sandbox; it remains attached across that transition.

The complete native Codex bundle must be installed in a captured readable tool
location. The qualification mounts it read-only at `/usr/local/lib/arcnexus/codex`;
placing it at an undeclared `/runtime` path failed with a missing sandbox helper.
The image includes Git, Bubblewrap, util-linux (`setpriv`), tini, curl and OpenSSL.
Missing curl fails the application's actual network qualification, rather than
silently skipping the check. Machine executable bindings remain deployment data.

With these prerequisites, the ten existing source-confinement, process-scope and
simulation-network cases passed inside Docker with zero failures/skips in 7.726
seconds. These include allowed reads, denied HTTP/TLS writes, direct proxy bypass,
descendants, source aliases, generated output and parent-loss cleanup. They use
controlled endpoints and the installed native sandbox; they are not model-driven
simulation or a real upstream publication demonstration. Host/container restart
and retained-volume relocation remain separate gates.

## Build and run the packaged supervisor

Build from the repository root:

```sh
docker build --file docker/Dockerfile --tag arcnexus:phase2 .
```

The multi-stage image pins Node's base image digest and the native Codex package,
contains the built supervisor and production dependencies, and excludes target
repositories and credentials. `HOME=/home/node` avoids retaining root's home after
the identity change. Mount the project volume at `/var/lib/arcnexus`, or override
`ARCNEXUS_VOLUME` with its actual mounted path. Provision that directory for the
configured non-root UID/GID before starting the container.

For a deployment with the Docker systemd cgroup driver, create a dedicated slice
before bind-mounting it. An empty keeper container can hold the slice while the
application container starts. The image entrypoint becomes a non-root, capability-free tini before starting
the application: Node alone is not an orphan reaper. Do not add Docker `--init`
to this recipe; its outer root-owned init could not signal the non-root application
with the restricted startup capability set. Release the keeper after the application
owns its scope, or when qualification finishes. Do not mount the Docker socket into either.

The following is the qualified invocation shape; substitute the volume and generated
seccomp policy paths. It demonstrates a read operation, not a running web service:

```sh
docker run --rm --read-only \
  --cgroup-parent=arcnexus.slice --cgroupns=host \
  --cap-drop=ALL --cap-add=CHOWN --cap-add=SETUID --cap-add=SETGID --cap-add=SETPCAP \
  --security-opt apparmor=arcnexus-container \
  --security-opt seccomp=/absolute/path/arcnexus-seccomp.json \
  --tmpfs /tmp:rw,exec \
  --mount type=bind,src=/sys/fs/cgroup/arcnexus.slice,dst=/sys/fs/cgroup/arcnexus.slice \
  --mount type=bind,src=/absolute/path/project-volume,dst=/var/lib/arcnexus \
  --env ARCNEXUS_CGROUP_ROOT=/sys/fs/cgroup/arcnexus.slice \
  arcnexus:phase2 arcnexus config get volume --json
```

Omit the command override to start the image's default headless lifetime service.
It holds the deployment open without starting engineering. Ordinary commands can
then use `docker exec <container> arcnexus-entrypoint arcnexus ...`; the entrypoint
applies the same non-root identity and capability drop to these invocations.
The returning `workday start` command is not the container's lifetime process.
No HTTP service is included yet.

On Docker stop, the lifetime service closes execution admission, obtains live host
identities over private IPC, signals those hosts and waits for their drain. The
closing marker remains until a replacement lifetime service opens admission.
Replacement alone never resumes engineering. Docker's external stop grace period
can still force hard interruption; the application does not impose a drain budget.

The product image itself passed the same ten enforcement cases plus three actual
background-host SIGKILL/SIGTERM/SIGINT cases: 13 passes, zero failures/skips in
37.499 seconds. Only compiled acceptance inputs were mounted; application code,
production dependencies and the native runtime came from the image. A separate
probe observed UID/GID 1000, all five capability sets zero, and no-new-privileges.

Using the packaged CLI outside any checkout, one container materialized and
registered a managed repository. A replacement container mounted the same volume
at `/relocated` and read the identical repository ID, architectural revision and
source base through the relocated source path. This establishes portfolio/storage
relocation; it does not establish relocation of unfinished execution checkpoints.

An actual Docker stop during a managed activation exited zero with the task and
assignment already persisted as interrupted. A replacement container retained that
state and the exact model-call evidence without replay. A preceding forced loss
also retained evidence; explicit resume correctly refused its unsafe checkpoint.
These used controlled model inputs, actual project hosts and the packaged sandbox.
They establish deployment behavior, not the real-agent self-development gate.
Both the application and PID 1 tini were observed as UID/GID 1000 with every
capability set zero and no-new-privileges. Runtime artifacts and volume are retained
under the phase-two container qualification evidence.
