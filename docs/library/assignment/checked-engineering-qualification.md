# Checked engineering live qualification — issue 109

On 2026-11-02, the normal `task run "<prompt>"` production path completed a real
version-five change using the installed Codex executable. This is the first live
gate of the minimal-configuration plan: a steward changed documentation, regression
tests and implementation through the checked edit tool. It is a small qualification
package, not an ArcNexus self-improvement or a multi-owner/workday qualification.

## Captured execution

- Executable: `/usr/lib/chatgpt/resources/codex`, version `0.163.0-alpha.10.2`.
- Node: `22.22.1`; bubblewrap: `0.11.1`; Linux delegated cgroup-v2 containment.
- Profiles: Luna engineering (`gpt-6-luna`), Astra director/reviewer (`gpt-6-astra`),
  medium reasoning, disabled web search, no execution budgets.
- Supervisor: `runner-ouNrjF`, immutable runtime hash
  `334ff4c1b620fa4abf125fd01f4558ae8ddafbb78f2e26e2cb9206327afd184a`.
- Source authority: `69870d8b4ef83e2a96cc1c86a2f53ee4bd9f0cd5`.
- Task: `884a23ad-cf35-4518-9ae3-616002a0e402`, completed, CLI exit 0.
- Engineering report: `6cc115f3-87f7-4d22-a745-04849fd5b28c`.
- Independent verifier: `f28d8cfd-ad75-4cc1-a545-18d5ba82ea2e`.
- Final director assessment: `df6d80f1-16b0-4b2b-a87e-864891ff14d1`.
- Promoted candidate: `00e72f43fdb8e83291e1db249e9b7a4c14110604`.

The prompt requested an exported `doubleMeaning()` returning twice the existing
`meaning` constant, preserving `meaning = 42`, with documentation and an observed
failing-then-passing regression. The declared shared operation was
`node --test tests/reader/value.test.js`, available during research, testing,
implementation and review. The platform supplied profiles, reads and operation
usages; the leaf declared ownership and its public module.

## Observed evidence

Two committed checked-edit transactions changed exactly `docs/reader/value.md`,
`tests/reader/value.test.js` and `src/reader/value.js`. The specification first added
the documented behavior and regression. The host then observed exit 1 because
`doubleMeaning` was not exported. Implementation added the function; subsequent
host checks passed both regression cases with exit 0. The independent verifier
accepted all six captured criteria using actual source and host command evidence.
The final director accepted the goal with no deficiencies.

The original source checkout remained clean. The retained actual diff has SHA-256
`aed20c3a6a3d6137901256a882514123c328882752e383cf00ec124040f157ce`.
Local raw reports, model streams, edit journals, operation logs, candidate and diff
remain under:

```text
/home/adrian/.local/state/arcnexus-qualification-109/engineering-20261102T031834Z/
```

## Unsuccessful probes and limits

Earlier retained probes are not successes. `engineering-20261102T031430Z` retained
an architectural question because copied purpose/role text explicitly prohibited
source mutation. `engineering-20261102T031551Z` captured checked specification edits
and expected-red evidence, then failed because its operation declaration excluded
implementation activity. The final fixture also recorded a rejected preflight before
its operation activities were corrected to the declared role vocabulary. Each change
received a new source revision before execution; no active authority or acceptance
criteria were rewritten.

The read-only probe `readonly-20261102T025840Z` exposed invented separate-stream
criteria and duplicate review routing (issue 117); those failed tasks remain retained.
This successful engineering task does not establish that separate routing defect as
fixed. Deterministic suites, repository static checks and CI are reported separately.
The other five live gates and the full executable configuration migration remain open.

## Later qualification updates

The [real workday and recovery run](../workday/checked-workday-qualification.md)
subsequently established minimal-plan live gates 3 and 4 at a safe checkpoint.
The later workday audit also established native owned/cross-owner write denial
(live gate 5). Multi-owner discovery and ArcNexus self-improvement remain outstanding; the earlier statement about five remaining gates describes this
first task's checkpoint.

After correcting director acceptance boundaries, the exact original read-only prompt
completed as task `ba0f2a23-e19c-4199-bc1f-d88ad3ae9565` with one reader assignment,
independent verifier `2b21e10f-bb44-42bf-b62a-318c91a6bf53`, final director assessment
`6a6cc9a8-03fd-4ed1-9f3f-6136dd456fcd` and CLI exit 0. Its source revision stayed
`514abab86a413f4d4dc00ac2f8add38791e32923`. Evidence is in
`readonly-20261102T025840Z/task-host-checkpoints.log` and the referenced reports.
The previous task that repeatedly awaited its own future review was cancelled and
retained; it prompted the structural continuation-loop guard in issue 119.

## Real ArcNexus self-development delivery (2026-11-02)

Minimal-plan live gate 6 now has a completed production-wiring demonstration.
Task `d62115a1-2969-42d8-9351-8da587f564f0` ran against source and frozen
supervisor revision `5c97c155f37dc562cfeae801423c987866f58c6b`. The supervisor
installation `/home/adrian/.anx109/qualification-final-5c97c15` was not rebuilt or
modified during execution. The attached CLI exited 0 after final director acceptance.

The report steward (Luna) used checked transaction
`report-doc-evidence-guidance-20261102-01` to add 26 lines to
`docs/library/report/report.md`. It explains totals versus passing/skipped counts,
why exit zero does not qualify skipped cases, and the distinct limits of deterministic,
native-enforcement, live-model and revision-specific CI evidence. No implementation,
test, architectural authority or supervising runtime changed.

Retained evidence is beneath
`/home/adrian/.local/state/arcnexus-qualification-109/self-development-20261102T064500Z`:

- Task output: `task-verified-supervisor.log`.
- Worker report: `state/runs/44f48dad-cfec-4752-bd3e-bc5b5acefbcc/report.json`.
- Independent Astra review: `state/runs/c8212b37-3f0d-4bc2-b4bd-0b80d9641ab3/report.json`;
  all six assignment criteria accepted, no deficiencies.
- Final Astra director assessment:
  `state/runs/e007d947-d3d2-4879-92c9-8d6cbc396e72/report.json`;
  all seven goal criteria accepted, no deficiencies.
- Actual patch: `verified-self-development.diff`, SHA-256
  `e07583387e825e42a5e85a809822134f12f64ce38c4270c4fb3c321c63ea59d8`.
- Verified application-owned candidate: `e84f31e864bd358d056050e832b895d7a37b2129`.

Observed host checks passed: type checks, builds, full tests, report component tests,
guidance validation, formatting and lint. The full test result was 582 total,
462 passed, zero failed and 120 skipped; report tests were 25 total, 16 passed,
zero failed and nine skipped. Neither reviewer counted skips as passes or inferred
CI success. Source-edit evidence and rejected host-only operation requests remained
visible; rejected operations did not execute.

The caller inspected the complete actual diff, matched its hash to both assessments,
confirmed that only the report document changed, and applied that exact patch in
commit `b216058`. The steward did not commit or publish. This is an actual ArcNexus
improvement delivered through the stable runtime, not a scripted fixture response.
The preceding failed attempts remain retained as failed evidence. Live qualification
does not complete the outstanding executable legacy-path retirement or establish
integrated checks/CI for later implementation revisions; phase three remains blocked.

## Final runtime refresh after legacy-path retirement

A fresh real task under implementation `28498b6` completed on 2026-11-02 after
removal of the writable harness, inline initializer and separate session-loop paths.
Task `52d85da2-713e-4285-aaa3-37c7763ab384` used the unchanged qualification source
`69870d8b4ef83e2a96cc1c86a2f53ee4bd9f0cd5` in a new isolated repository. The attached
CLI exited 0 and the source checkout remained clean. Its frozen runner `runner-jepZfa`
has hash `5b18e23ac0f980820102a3215695111da325fafff38587be41ae2fe1e4314ac1`.

Evidence root:
`/home/adrian/.local/state/arcnexus-qualification-109/final-engineering-28498b6`.
The actual three-file patch is `verified.diff`, SHA-256
`454a827db5a894758ef31706813dc6e454850b2e5e50acb822b3de0313b3a1da`.
Candidate `c15bf00d53f3604bb92270e5d63822043933bffe` adds the documented
`doubleMeaning()` function and its public-module regression while preserving 42.

Worker `38a35a96-49ce-4758-9bc3-d7a98baeef9c` used Luna. Its host evidence records
baseline exit 0, expected-red exit 1 because `doubleMeaning` was not exported,
then verification, frozen regression and captured acceptance exit 0. The checked
specification edit preceded the failure; implementation followed it. Independent
Astra verifier `c383cfe1-a4fb-4bbf-babe-14ac2ad6f699` accepted all five assignment
criteria without deficiencies. Final Astra director `de493781-596e-4088-94c9-026441b22f3d`
accepted all six goal criteria and independently reran the declared test operation.
This refresh qualifies the changed production harness; it is separate from the earlier
multi-owner/workday and real ArcNexus self-development demonstrations.
