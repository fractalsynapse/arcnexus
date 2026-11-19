# Efficiency foundation contract amendment

Status: the architect approved exact patch `cb6a431032a9` in Codex chat and
delegated application and implementation. All resulting contract and registry bytes
match the approved manifest. The actual human approval receipt is retained in
application evidence as `615-efficiency-amendment-approval.json`. The
[implementation checklist](../../../../docs/plans/efficiency-foundation.md)
records the complete engineering and live acceptance work. The
[prompt practices](../prompt-practices.md) records the planned authoring method.

This proposal implements the architect's direction to reload approved architecture
during a run, reuse parameterized operations with activity completion verification,
provide full live observations, and continuously measure and optimize elapsed time,
tokens and attributable cost overall and per execution profile.

## Exact review artifacts

- [Complete contract and registry diff](efficiency-foundation.patch)
- [Baseline and before/after file digests](efficiency-foundation.json)

Baseline: `2522d2ec46a6759e007b8be389829143be0fafcf`.
The manifest records the SHA-256 of the exact patch. Approval must identify that
patch and delegate application before any locked bytes are edited. The conditional
registry annotation is not an approval record: retain the actual human decision
and delegation in the existing approval/evidence path before application.

## Why an amendment is necessary

Project PRJ-4 currently makes a new run the way to see changed authority.
Architecture ARC-8/17/22 and Execution EX-18/25 require a task-wide capture and
prohibit changing active authority. Applying the requested dynamic model without
amending those clauses would violate them. The proposed replacement lets the
trusted host adopt an exactly approved update between activities in the same run,
after validating required implementation and available handlers. It retains the
same task, checkpoints, journal and original acceptance. Completed observations
keep the actual model under which they were produced.

The draft changes these public boundaries together:

| Interface | Proposed change |
| --- | --- |
| Project | Replace task-wide freeze with validated adoption of an approved model at an activity boundary. |
| Architecture | Deterministic merge, reload, provenance, full selected purpose/instructions, typed operation defaults/overrides and referenced activity verification. |
| Execution | Enforce the selected adopted model, run activity checks, retain/stream complete exposed events, and account for timing/usage/profile identity. |
| Coordination | Use the existing journal/artifacts for ordered live observations, adoption and derived profile-aware metrics. |
| Direction | Preserve accepted outcomes and criteria; plan revisions cannot grant authority. Read complete findings and current model context. |
| Verification | Bind observations to resolved parameters and the applicable model, refresh affected checks and retain independent review. |
| CLI | Stream long-running `--json` commands as JSONL events plus a terminal result; preserve single-object `inspect --json` and exit semantics. |
| Agent | Resolve the next activation against the latest host-adopted approved model and make complete authorized run evidence readable. |
| Workflow | Adopt at the existing safe boundary and reuse the same lifecycle for activity checks, live events and measured refinement. |
| Commands | Forward the structured event/metric stream without terminal policy or another task lifecycle. |
| Manager | Let approved guidance reach the next activation without changing an in-flight request or granting candidate-side authority. |

Workflow, Agent, Commands and Manager retain their proposed stage. Other changed
contracts retain their locked stage. The registry diff preserves prior digests and
updates counts and new digests. No limit, time budget, token ceiling, retry count,
content truncation or automatic profile substitution is proposed.

## Review consequences

The model evolves during an invocation, so an activity result must identify its
actual model, operation parameters and runtime. Newly approved declarations cannot
activate absent handlers. Adoption must be coherent: context, Team, grants and
verification change together before the next activity, and incompatible retained
work produces an explicit diagnostic. Candidate edits never serve as approval.

After exact approval and protected application, the implementation still needs
regressions, the rewritten catalog, assembled verification and live proof. Approval
of this interface amendment does not declare missing functionality delivered or
approve unseen later architecture/prompt changes.
