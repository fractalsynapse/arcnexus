# Production checks inside recovery scenarios

This intent record is for Execution maintainers diagnosing the prerequisite for
Delivery's prepared-publication scenarios. It supports the next Testing and
Implementation decisions for `recovered-check-confinement-prerequisite`; it does
not establish that the missing capability has been delivered.

The governing [Execution obligations](../contract.md#obligations) require native
Bubblewrap confinement, captured operations and actual exits and logs (EX-10,
EX-16, EX-24 and EX-27). Preserve retained work and answers under EX-17, EX-22 and
EX-25. No part of this investigation authorizes weakening confinement, changing
protected authority, replacing acceptance or bypassing independent verification.
A required boundary change needs the architect's exact approved proposal through
the existing host adoption path.

## Retained observation

Run 194 belongs to task
`e26601da27dea363f75038b025d3a59494a42024b3817ed562c5000677ca5961`,
issue 730, branch `730-task`, with engineering base and activation source revision
`650b1a356e1525862717cff8f194ff99e628f214`. The run timeline records issue and
branch at sequences 145662 and 145663. The complete retained artifact is:

```text
evidence/e26601da27dea363f75038b025d3a59494a42024b3817ed562c5000677ca5961/194-268-owner-tests.log
sha256: 2fe74c8f0b00091387f6b5bd0611cdec54a6147b8cec860936c3947f4cdfa78a
```

Resolve this reference in the existing external application storage, through
mapped complete-file reads; it is not a source-tree log. The complete artifact
was read for this record. The timeline associates it with captured
`owner-tests`, command `npm`, arguments `["test", "--", "delivery"]`, owner
`delivery`, activity `testing`, expected pass, actual status 1, and check-input
identity `001943f75d86acb5f0852d0c856205456df4c2f861c5c33434dce748e01ccb43`.
Its cwd is the run-194 task worktree. The log shows the build and five Delivery
suites running, then 38 passing and 12 failing tests, with none skipped.

The embedded canonical fixture artifacts retain the original command's log:

```text
bwrap: Creating new namespace failed: Permission denied
```

The log bytes, including the final newline, have SHA-256
`dee5b169b7b3ef1a04c7c0c99a2b41b27f9775bc7dc257af4fe420b7465c49d4`.
For example, the embedded `execution-round-consumption-80GUUW` artifact is
`3-8-fixture-check.log`. The other failing scenarios retain the same diagnostic.
The declared `recovery-check.mjs` never produces its JSON output: Bubblewrap
fails before the script starts. This is setup failure, not the intended
recovered-command behavioral red. Successful unrelated Delivery assertions do
not discharge it.

The actual activation records identify Node v22.23.5. The inspected evidence does
not establish the effective kernel policy, Bubblewrap version, container image
identity or the exact namespace syscall that was refused. Do not infer those
facts from a temporary path or from the provider's model name.

## Production path and working hypothesis

[owner-tests](../../../.arc/architecture/operations/owner-tests.yaml) resolves the
accountable owner into argv and declares networkless execution.
[runCheck](../src/run-check.ts) validates the captured operation, prepares candidate
dependencies where applicable and binds observations to their check inputs.
[check](../src/check.ts) then launches `/usr/bin/bwrap` with
[checkMounts](../src/check-sandbox.ts), the resolved cwd, executable and argv.
[execute](../src/process.ts) retains process output and actual status.

The common sandbox configuration unshares namespaces, including the user
namespace, clears the environment, exposes the system toolchain read-only,
provides private proc/dev/tmp mounts and overlays the candidate worktree.
The Git common directory and prepared dependencies are mounted read-only;
the common directory's `arcnexus` binding subtree is hidden when present.
The sandbox supplies its declared environment rather than host credentials.

Crucially, `verifyCheckSandbox` in that same source requires
`unshare --user /usr/bin/true` to fail inside the normal check boundary.
The boundary's own probe therefore treats denied further user-namespace creation
as an isolation property. Merely enabling namespace creation on the outer host
does not demonstrate that a nested check can create it.

Delivery's [prepared fixture](../../delivery/tests/fixtures/prepared-publication.ts)
uses real Execution admission/preparation, Workflow and Verification. It does
not replace `HostTask.check`. Verification therefore attempts another production
Bubblewrap launch from within the outer owner-tests sandbox. The generated script
comes from maintained [TypeScript](../../delivery/tests/fixtures/recovery-check.ts);
its original phase should exit successfully and its current phase should reject
an invalid baseline with status 1 and the complete diagnostic.
[Evidence assertions](../../delivery/tests/fixtures/recovery-evidence.ts) inspect
actual outputs, command, argv, cwd and input bindings.
[Retained-publication scenarios](../../delivery/tests/integration/retained-publication.test.ts)
depend on those commands before claiming recovered acceptance or publication.

The source and observed failure support a nested-user-namespace prerequisite
hypothesis. They do not yet isolate whether the effective denial comes from
Bubblewrap, inherited runtime policy or another host restriction. Testing must
identify that causal boundary rather than documenting a guessed kernel setting
as the repair.

## Required distinguishing evidence and handoff

Exercise the unchanged production check boundary through an authorized captured
Execution operation. Record the actual runtime identity and confinement
configuration, and isolate the failed namespace prerequisite in disposable fixture
state. Compare the ordinary host boundary with the nested boundary under the
same relevant inputs where the available operation permits it. Keep complete
diagnostics when a prerequisite prevents that comparison.

A supported path must let the declared successful and failing commands actually
execute through unmodified `HostTask.check` with real Bubblewrap. Retain command,
argv, cwd, exit, complete log, candidate/check-input identities and the applicable
capture. A favorable controlled reviewer response, synthetic exit, disabled case,
test-only check replacement or execution outside required confinement cannot
satisfy `confined-production-check-capability`. The historical composed diagnostic
approach mentioned in the supplied research archive is consequently insufficient
for this supplier's stronger acceptance.

If the captured runtime cannot supply the prerequisite, retain an explicit named
external hold identifying the observed denial, responsible operator/environment
action, evidence and continuation position. Do not silently choose another
profile, grant extra capabilities, alter a protected operation or retry unchanged
failure. Any necessary runtime or authority adoption follows the existing approved
route. This documentation activity has no mapped process/check operation and
makes no new native execution or environment-availability claim.

The final supplier answer must state the supported captured invocation and
environment, actual successful and failing evidence, applicable Execution quality
observations and any remaining prerequisites. Until those exist, Delivery
Testing remains unfinished. Preserve its acknowledged fixture edits, the original
issue/task and acceptance, checkpoint bytes, verbatim human answers and failed
observations. The engineering base, active authority, secured checkpoint and
independently reviewed candidate remain separate identities.

After the prerequisite is satisfied, Delivery resumes its original scenarios and
assertions. [Workflow](../../workflow/contract.md) retains sequencing and repair;
[Delivery](../../delivery/contract.md) observes provider facts and reconciles one
publication; Verification and the host retain assembled checks and independent
acceptance. An earlier candidate's approval cannot approve a recovered tree,
capture or staging parent. A checkpoint receipt or this documentation's completion
cannot establish staging delivery.

## Source validation

This documentation-only step checked the complete retained log and timeline,
the four linked Delivery fixture/scenario sources, captured owner-tests declaration,
and current Execution command, sandbox, process and check-input orchestration.
The inspected `check.ts` digest is
`b2fbb328170567eafb556e32447a39ee2de2e863da82663d364ad123b8799aec`;
`check-sandbox.ts` is
`18c5a69837c4f0d6e828da5f09ec9224ca972d3f49b1d7068784ce482dc33c74`.
The prepared Delivery fixture digest is
`ce32b34098248d9eb84b4594e2375135f6592767d4def8cfc762b11b02789b58`.
These candidate-source identities supplement the original base; they do not
relabel historical observations as results from this prose edit.
