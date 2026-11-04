# Container qualification

Status: deployment qualification is in progress. The container confinement and
restart gates have not passed; this is not yet a supported production recipe.

The supervisor needs a writable, dedicated cgroup-v2 subtree to terminate managed
process trees, and an outer container policy that permits its nested Linux sandbox.
Application and supervising-runtime mounts remain read-only. Keep repository,
candidate, database and evidence state in the project volume. Worker filesystem
and network permissions still come from captured ArcNexus authority.

## Dedicated outer policy

[arcnexus.apparmor](../../docker/arcnexus.apparmor) is derived from Moby's container
profile at commit `6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef`. It preserves the system
path and network-family denials and permits the mount operations needed inside a
new user namespace. Use it only with **all outer capabilities dropped**, a read-only
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
it requires administrator authentication and enforcement qualification is pending.
These results establish the prerequisites of these specific configurations, not a
universal container limitation. Detailed commands and logs are retained with the
phase-two development evidence.

Primary contracts: [Docker container options](https://docs.docker.com/reference/cli/docker/container/run/),
[Docker seccomp](https://docs.docker.com/engine/security/seccomp/), and
[Moby's pinned policies](https://github.com/moby/profiles/tree/6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef).
