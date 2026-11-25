# Linux Host confinement

The trusted launcher applies these profiles to the execution Host. The Host
runs as a non-root user with an empty capability bounding set and Linux
no-new-privileges. Project images, remote assignments and operations cannot
select the container's security profile.

- The launcher starts with Moby's default seccomp profile and adds the exact
  namespace sets for project checks and Codex's filesystem sandbox. It also
  permits the mount and pivot calls for the private filesystem and detached
  unmount. It returns `ENOSYS` for `mount_setattr` so Bubblewrap uses the
  AppArmor-mediated remount fallback.
- AppArmor permits the private filesystem's mount types and destinations.
  Docker's masked procfs mounts prevent Bubblewrap from mounting procfs for
  its inner PID namespace. The launcher selects the container-specific
  `systempaths` override and the installed policy replaces those masks and
  read-only rules with explicit procfs and sysfs denials.
- The AppArmor execution transition stacks narrower permissions on the
  check process. The process cannot create another user namespace,
  mount or unmount filesystems, change its profile, or gain capabilities.
  Its network namespace is separate and retains loopback for local tests.

The [production check runtime prerequisite](production-check-runtime.md) records
why a confined integration check cannot currently construct another production
check sandbox, the retained observations and the required operator/architect action.

Load the profile with `apparmor_parser` as described in the
[Host setup](../../host/README.md). The verified configuration uses
AppArmor ABI 5.0 and Docker Engine with seccomp on Linux. The Host refuses to
claim requests if it cannot create and verify a private overlay and network
namespace. The launcher validates the image and policy when reusing a container.

`moby-default.json` is the [Moby seccomp profile at commit a0fa708](https://github.com/moby/profiles/blob/a0fa70805f742f7da15b367770d802ea2a86c68b/seccomp/default.json),
reformatted for this repository. The AppArmor rules adapt the
[Moby container profile](https://github.com/moby/profiles/blob/a0fa70805f742f7da15b367770d802ea2a86c68b/apparmor/template.go).
Both include their upstream [Apache 2.0 license](MOBY-LICENSE).
