# Scope-wrapped engineering commands

Confinement places every supervised command in its own child cgroup so cancellation can stop the
whole process tree. Creating that child needs a **delegated cgroup subtree**, and the harness or
container that starts an agent often mounts `/sys/fs/cgroup` read-only. The observable symptom is
`EROFS: read-only file system, mkdir '/sys/fs/cgroup/…/arcnexus-<uuid>'`, after which every suite
tagged `native-host` skips itself and the checks that actually exercise confinement, git delivery and
the real harness silently stop running.

`node scripts/foundation/with-scope.mjs <command> [args…]` runs the command as a transient user
service, which obtains the delegation from the caller's own systemd user manager. It changes no
filesystem permissions, asks for no elevated access, and forwards the caller's environment and exit
status.

```bash
ARCNEXUS_TEST_CODEX="$HOME/.local/share/arcnexus/tools/<bundle>/codex" \
  node scripts/foundation/with-scope.mjs npm test --silent -- operations
```

## What it unlocks

- **Local results that match CI.** With the variable above set, `native-host` acceptance suites run
  instead of skipping, so a candidate's confinement, delivery-git and preparation behavior is
  observed before a PR rather than discovered by CI after it.
- **Real self-development.** `task run`, workday and delivery paths create the same scopes, so the
  engineering loop needs one command form rather than a privileged shell.
- **No approval round-trips.** The scope is granted by the user's own manager, so a sandboxed agent
  session can run the full test profile without widening its filesystem access.

The wrapper is a **runner convenience, not a check**: it grants nothing, and ownership, checked
edits, verification and release authority are unchanged. When a delegation probe already succeeds,
the command runs directly and nothing is nested, so wrapping a wrapped command is harmless.

## Dependency preparation keeps the previous tree

Setup operations declare disposable outputs — `node_modules`, `.test-build`, `dist` — which were
formerly deleted _before_ the installer ran. An install that then failed for an environmental reason
left the workspace with no toolchain at all, which turns one transient fault into a rebuild of
everything. Preparation now **renames those outputs aside** into `.prepared-stale/` (ignored), runs
the installer, discards the aside copy once the replacement is verified, and puts it back if the
rebuild fails. Outputs left behind by a failed preparation are not evidence, so they are replaced
rather than merged. See `src/library/operations/prepared-dependencies.ts`.
