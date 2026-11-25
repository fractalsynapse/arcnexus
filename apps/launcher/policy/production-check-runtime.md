# Production check runtime prerequisite

Status: **production-check-runtime-policy hold**. The required nested production
check capability is unavailable under the inspected invocation and current
authority. This diagnosis does not satisfy `supported-production-check-runtime`.

## Supported entry and boundary

The operator enrolls and admits the launcher, then uses
`arcnexus-launcher connect <assignments.json>` or
`arcnexus-launcher start <assignment.json>` as described in
[Host setup](../../host/README.md). The assignment pins the project, revision,
approved base and image. [Host runtime](../src/host-runtime.ts) verifies those
identities, applies [Host policy](../src/host-policy.ts), and waits for readiness.
It refuses reuse with a different assignment, image or security configuration.

The Host runs as `node`, drops all container capabilities, enables
no-new-privileges and selects `apparmor=arcnexus-host` plus the bundled seccomp
filter. Its systempaths override is paired with explicit AppArmor procfs/sysfs
restrictions. These are repository implementation facts, not an inspection of
the running Docker daemon or loaded kernel policy.

The trusted Host constructs a check sandbox. The
[AppArmor policy](arcnexus-host) then stacks `arcnexus-check` on the executed
check. It explicitly denies user namespace creation, mounts, unmounts,
pivot_root, profile changes and capabilities. The
[Execution readiness probe](../../../packages/execution/src/check-sandbox.ts)
requires further `unshare --user` from a check to fail. The
[production check implementation](../../../packages/execution/src/check.ts)
always launches Bubblewrap with the captured mounts, argv and cwd.

The integration suite itself is an ordinary confined check. Its real
`HostTask.check` therefore attempts sandbox construction from a process already
subject to the narrower boundary. The inspected launcher supports starting the
trusted Host, not a privileged delegation endpoint for arbitrary check processes.
Calling the existing launcher from within a check does not remove its inherited
restrictions. Neither an enabled global sysctl nor copying the seccomp allowlist
establishes a working nested path.

## Retained observations

The authoritative observation is run 194 artifact
`194-743-owner-tests.log`, SHA-256
`2344968159eb8260b6acf804ddf943d0558e0f0393c40650fa03001602ae5ada`,
in the existing task's external evidence directory. The complete file retains
`nativeCheckDiagnostic` and `productionCheckObservation`, including argv, cwd,
logs, capture, tree and input identities. Earlier observations remain in
`194-646-owner-tests.log` and Delivery's `194-268-owner-tests.log`.

Both captured commands, `/usr/bin/node command.mjs success` and
`/usr/bin/node command.mjs failure`, used the reconstructed worktree's
`nested` cwd and exited 1 before either payload executed. Their complete
diagnostic, expressed as a JSON string to preserve its final newline, is:

```json
"bwrap: Creating new namespace failed: Permission denied\n"
```

The expected payload exits are 0 and 37. The namespace setup failure supplies
neither a successful command observation nor the intended failing-command
observation. Execution reported 270 tests, 253 passing, one failing and 16
pre-existing skips; this required scenario was the failure and was not skipped.

The actual diagnostic process reported Node 22.23.5, kernel 7.0.0-43-generic,
Bubblewrap 0.13.1 and util-linux 2.38.1. Its active AppArmor label was
`arcnexus-bwrap//&arcnexus-check//&arcnexus-host//&bwrap//&unpriv_bwrap (mixed)`.
Capability sets were empty, NoNewPrivs was 1, and Seccomp was 2 with one filter.
Raw `unshare --user /usr/bin/true` also exited 1 with
`unshare: unshare failed: Permission denied\n`.
The observed sysctls were max_user_namespaces=2147483647,
unprivileged_userns_clone=1 and apparmor_restrict_unprivileged_userns=1.

These observations establish effective denial in this runtime and are consistent
with the repository's intentional check restriction. They do not identify which
stacked profile or syscall filter produced a particular denial. The fixture
reported runtime identity as unavailable. It did not capture loaded AppArmor
policy bytes, kernel audit attribution, Docker inspect/image identity or the
effective seccomp filter. The launcher reuse test validates configuration
comparison against a controlled Docker-shaped record; it is not live engine
or nested execution evidence.

## Required action and release of the hold

The responsible machine operator must retain the actual container/image IDs,
approved assignment and base, Docker/OCI configuration, loaded AppArmor policy
and stacked profile identities, effective seccomp configuration, and correlated
kernel audit records for the exact failed namespace calls. This activation has
only mapped project reads, checked edits and quality checks; it has no Docker,
audit, loaded-policy inspection or architectural question/proposal operation.
The missing operator evidence cannot be reconstructed from repository policy.

The architect must resolve this question through the architecture proposal route:
how should captured integration operations exercise unmodified production
`HostTask.check` while ordinary check processes remain unable to create user
namespaces, mount filesystems, change profiles or gain capabilities? Any changed
boundary or protected declaration requires an exact reviewed diff, recorded human
approval and trusted host validation/adoption before use. No relaxation is approved.
Execution's locked obligations require Bubblewrap confinement and captured
operation authority; the project contract reserves runtime adoption to the trusted
host. A candidate-side policy edit cannot supply that authority.

After an authorized supported path exists, execute the unchanged public
characterization through it. Retain actual successful and failing payloads,
command, argv, nested cwd, exit, complete logs, runtime/image, capture, candidate
tree and check-input identities. Demonstrate that disposable writes do not reach
source and that the existing namespace-denial probe still holds. Refresh affected
checks and independent review against the recovered candidate before delivery.

Keep Execution's `recovered-check-confinement-prerequisite` Testing continuation
and Delivery's `recovered-publication-executed-checks` Testing continuation pending.
Retain issue 730, branch `730-task`, task
`e26601da27dea363f75038b025d3a59494a42024b3817ed562c5000677ca5961`,
original base and acceptance, checked bytes and receipts, verbatim answers and
failed observations. This hold creates no second delivery or publication.
