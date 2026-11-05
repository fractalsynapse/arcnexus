#!/bin/sh
# Delegate only this container's cgroup, then replace startup with a capability-free supervisor.
set -eu

if [ "$#" -eq 0 ]; then
  echo 'Expected a supervisor command' >&2
  exit 2
fi

# Only the container lifetime needs an init; exec-based CLI controls use its existing reaper.
if [ "$$" -eq 1 ]; then
  set -- /usr/bin/tini -- "$@"
fi

if [ "$(id -u)" -ne 0 ]; then
  exec setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs "$@"
fi

uid="${ARCNEXUS_UID:-1000}"
gid="${ARCNEXUS_GID:-1000}"
case "$uid$gid" in *[!0-9]*) echo 'Expected numeric runtime UID and GID' >&2; exit 2 ;; esac
if [ -z "$uid" ] || [ -z "$gid" ]; then
  echo 'Expected nonempty runtime UID and GID' >&2
  exit 2
fi
if [ "$uid" -eq 0 ] || [ "$gid" -eq 0 ]; then
  echo 'Runtime UID and GID must be nonzero' >&2
  exit 2
fi

# The deployment supplies a dedicated parent; never delegate that parent or all host cgroups.
parent="${ARCNEXUS_CGROUP_ROOT:?Expected dedicated mounted cgroup parent}"
case "$parent" in /sys/fs/cgroup/?*) ;; *) echo 'Unsafe cgroup parent' >&2; exit 2 ;; esac
if [ "$(realpath -e "$parent")" != "$parent" ]; then
  echo 'Cgroup parent must be canonical' >&2
  exit 2
fi
scope="/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)"
case "$scope" in "$parent"/*) ;; *) echo 'Container is outside dedicated cgroup parent' >&2; exit 2 ;; esac
if [ "$(realpath -e "$scope")" != "$scope" ]; then
  echo 'Cgroup scope must be canonical' >&2
  exit 2
fi
chown "$uid:$gid" "$scope" "$scope/cgroup.procs" "$scope/cgroup.threads" "$scope/cgroup.subtree_control"

# No model, project hook or application command executes before this irreversible drop.
exec setpriv --reuid="$uid" --regid="$gid" --clear-groups \
  --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs "$@"
