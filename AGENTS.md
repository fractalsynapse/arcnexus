# ArcNexus

Read the [charter](docs/charter.md), [development direction](docs/dev.md), and the
applicable [locked contracts](docs/interface/README.md). The aim is real
architecture-directed self-development through the host CLI.

## Authority and ownership

The architect owns project intent, boundaries and contract changes. Before editing,
check the request against the applicable locked clauses. If they conflict, name
the clause and consequence, propose a resolution, and wait for the architect.
Approval can authorize a named editor or the trusted host to apply the exact
reviewed change on an issue branch. Agent checked-edit tools refuse locks and
their registry. Host application requires the recorded human approval and matching
baseline and cannot change active captured authority.

The [catalog](.arc/architecture/project.yaml) names the sole owner for every path.
Change only the accountable owner's scope. Use another plugin through its public
entry and request its contribution through the director when necessary. Candidate
edits cannot widen the active task's authority, change its checks or rewrite its
acceptance. Generic product code consumes the target project's guidance as data
and keeps ArcNexus-specific release rules in this repository.

## Working style

- Make every public interface a Cordis plugin. Co-locate its contract, public entry,
  implementation, docs, tests and owner-specific scripts. Compose the CLI in
  [apps/cli](apps/cli/README.md).
- Use the least code that satisfies the accepted outcome. Define each responsibility,
  service shape and command once. Reuse its definition directly. Omit boilerplate,
  duplicate implementations and compatibility machinery for the previous runtime.
- Never introduce a limit without the human architect's express permission. Let the
  harness govern its capacity. Do not impose arbitrary content, collection, context,
  retry or execution caps, or silently truncate information to fit an invented limit.
- Author all maintained code in strict TypeScript, including tests, fixtures and
  build and CI tooling. Follow the class and helper rules in the
  [TypeScript standard](docs/foundation/typescript-standard.md).
  Add a seam for a real consumer or independently replaceable responsibility.
- For behavioral changes, record intent first and observe a failing public regression
  before implementing. For refactors, preserve the behavioral evidence. Use only
  the checks relevant to the current contribution, then verify assembled delivery
  against captured acceptance.

## Agent and Team

Agent is the central conceptual model of ArcNexus. Use one scoped Agent interface
for the director, component stewards and independent reviewer. Applications and
plugins inspect, activate or manage those agents through their public boundary.
Read the [Agent contract proposal](packages/agent/contract.md) for the shared view
of purpose, instructions, observations, standards and allowed operations. Resolve
the current activity from the captured catalog and plan position. Activities select
the Agent's role, profile and capabilities for the work at hand. Author each
activity in its component specification. Missing activities are unavailable.

Team gives Direction an ordered roster of eligible stewards and resolves resource
ownership from the captured catalog. Direction sequences requests and work.
Use the [Team proposal](packages/team/contract.md) for those boundaries.
The Director starts the Agent loop and the final Reviewer assesses the assembled
candidate through Verification. Route rejected criteria and evidence back to
Direction for correction. [Reviewer](packages/reviewer/contract.md) owns
`.arc/learning/` and returns evidence-linked lessons.
The CLI app owns terminal behavior and delegates through the
[shared Commands SDK](packages/commands/contract.md).

## Direction and evidence

The director generates the sequence from the [plan template](.arc/architecture/plan-template.md).
Each milestone has one accountable owner and stable acceptance criteria. Ordinary
tool, check and self-review failures return to the caller or earliest affected
activity within that milestone. Persist the rewind and preserve completed edit
receipts, complete answers and unaffected evidence. Direction engages initially,
on explicit escalation and after final independent rejection. Link
already accepted supplier work, or place required supplier work before the dependent
milestone. Escalate a decision that needs different authority. Human approval concerns
objectives, goals and architecture. Routine repairs, plan sequencing and authorized
staging delivery add no approval gates. External prerequisites remain named holds.
The host validates
authority and persists plan and learning records. Keep bulk logs and transcripts
outside source and preserve failed observations.

Follow the [qualification plan](docs/plans/self-development-mvp.md) for executable
changes and the self-development gate. Deterministic tests, actual host confinement,
CI and live inference are distinct evidence. Report gaps. Use existing evidence
when candidate, criteria and environment still match. During bootstrap, use the
repository delivery workflow for a named missing capability, then demonstrate
that capability through the platform and use it for subsequent work.

Refinement runs Plan, Architect and all approved priority-ordered goals. Each round
reassesses the guides and implementation using prior results. Goals contain
outcomes and success measures without component owners or execution results.
Architecture proposals require an exact human-approved diff. Deliver prerequisites
inside Architect through the normal task workflow before Run captures the new
accepted model. Approval pauses and interruptions retain the same round cursor.
Qualify with three consecutive live rounds showing useful guide and implementation
refinement and subsequent use of prior evidence. Justified no change is valid;
operator repair, bypassed checks and uncontrolled aborts break the streak. Changes
to the execution path restart qualification. Main and releases remain separate.

## Repository delivery

Use [release workflow](.agents/skills/release-workflow/SKILL.md) and the
[ArcNexus release procedure](.agents/skills/arcnexus-release/SKILL.md). Adopt or
create an issue, verify canonical HTTPS origin and current `origin/staging`, and
use the issue-numbered work branch. Keep commits and the staging PR issue-linked.
Record a changelog entry for visible changes. Use
[ArcNexus guidance](.agents/skills/arcnexus-guidance/SKILL.md) for guidance changes and
[verification](.agents/skills/arcnexus-verification/SKILL.md) before claiming readiness.
Agents integrate only after verified acceptance, green required CI and required
review. The architect controls production actions.

## CodeGraph

If `.codegraph/` exists, use CodeGraph to locate or understand code before searching
source. Leave indexing to the user. Otherwise use `rg`.
