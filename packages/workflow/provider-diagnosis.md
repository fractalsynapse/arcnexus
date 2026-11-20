# Refinement report provider diagnosis

The WFL-REF-COMPLETED-HANDOFF rejection concerns provider setup before the
existing recovery assertions. In retained `114-2-publication-check-failure.log`,
the successful-child continuation returns `failed` instead of `planned`, the
unfinished-child scenario never reaches reported usage, and nested Architect
returns `failed` before supplier cancellation. These observations do not establish
a recovery or report reconstruction defect. `114-8-repository-tests.log` reaches
all three scenarios locally, but cannot explain the hosted environment difference.

The hosted runner selects Node v22.23.5 at
`/opt/hostedtoolcache/node/22.23.5/x64`; Execution's native activation in
`packages/execution/src/codex.ts` supplies `PATH=/usr/bin:/bin`. The current
report-recovery installer copies a provider with `#!/usr/bin/env node` unchanged.
Its executable binding is absolute, but its interpreter remains PATH-dependent.
Unlike the prepared-context fixture's installer, it does not select
`process.execPath`. The retained hosted log contains assertion failures, not the
provider stderr or the resolved `/usr/bin/node` identity. Missing or incompatible
system Node is a hypothesis until a launch diagnostic is observed; local passes
must not be relabeled as hosted reproduction.

Characterize the installed provider as an executable process with Execution's
exact PATH and an explicit complete response input. Retain command, selected test
runtime, PATH, exit status, stdout and stderr through test diagnostics. Also launch
with an empty fixture-only PATH to expose the env-node dependency deterministically
without changing system files or relying on the developer's installed Node.
Require both launches to use the test runtime and emit the complete expected
finding, answer and reported usage. This rejects an installer that still depends
on ambient interpreter lookup, including environments where the confined PATH
happens to resolve the correct Node. The empty PATH is an isolated negative
control, not a changed production environment or a resource limit.

Keep the three real SQLite/Git recovery scenarios and their full history,
identity, answer and accounting assertions. Expose runtime identity as a controlled
native provider event, so retained originating artifacts identify the interpreter
actually used. The next Implementation activity should select the test runtime
explicitly in the installed executable, following the existing prepared-context
fixture. Reaching the original recovery assertions after that correction remains
required; setup characterization alone does not satisfy completed-round acceptance.

## Observed characterization

Retained `114-228-owner-tests.log` records the meaningful portability failure.
With `PATH=/usr/bin:/bin`, the installed provider launches as `/usr/bin/node`
v22.22.1, matching this check's test runtime, and emits the exact complete finding,
multiline answer and usage. With only the isolated empty-bin directory in PATH,
the same executable exits 127 before producing any provider event. Its stderr is
`env: 'node': No such file or directory`, followed by
`env: use -[v]S to pass options in shebang lines`. Both complete launch results,
environments and executable/runtime identities are retained in TAP diagnostics.
The failure is at the explicit runtime-portability assertion, not a compiler,
SQLite, Git, missing fixture file or report-history assertion. All three existing
recovery scenarios still reach and pass their original assertions locally in the
same observation. This establishes why local success is compatible with a hosted
setup failure without claiming to have recovered the unavailable hosted stderr.

The installer was extracted unchanged into `tests/fixtures/refinement-install.ts`
so the characterization and the real recovery scenarios exercise one installation
path. Implementation can correct that installer once and use the retained red
without repeating or weakening the original recovery scenarios.
