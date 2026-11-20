# Architecture model plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Resolve and validate the project, owners, profiles, operations, standards, role
bindings, host bindings, delivery policy and contract registry. Expose one resolved
model and one model-facing context builder to all callers. Each activation names
the approved model version it uses. Keep complete
definitions in the capture. The request includes the acting component's relevant
fields, the selected activity's resolved instructions and capabilities, and a
compact catalog index of identities, short summaries and source references rather
than every full component purpose. Include the acting purpose and selected activity
in full, with source provenance. Model settings belong in invocation options. Name withheld
inputs, reference applicable contracts by identity and path, and return requested
definitions whole from the capture. Activity standards are shared references and
filtered to the activity. The reviewer receives the complete evidence bundle under
the verification contract.

Codex discovers project directives and skills from its activation environment.
The request builder leaves their discovery and selection to Codex. The host
ensures the harness sees approved project guidance for the captured revision.

A component may inherit a missing non-activity property from the project where
that property permits inheritance. Authority and owned roots stay explicit. Every
component authors its own activity map. Each activity declares role, profile,
instructions, operations and standards. An empty list explicitly contributes
nothing. A host activity declares the host as executor and carries no model profile.
An absent activity is unavailable. A partial mapping or unresolved reference is a
validation finding. Neither activities nor their fields inherit project defaults.
The project selects director and verifier by their component and explicit activity.
Architecture updates select the project's explicit architect component and activity;
a missing binding makes that capability unavailable without affecting inspection.
A role supplies standing instructions and owns no files or commands. Operation
declarations describe the act and its parameters, prerequisites and confinement.
The activity grants the declared operation. Model-invoked operations bind a local
MCP handler and its exact argument schema. Inspection and activation use the
same captured bindings. An explicitly empty list exposes no project tools.
Operation parameters have declared types and defaults. Resolve permitted component
overrides and then activity-binding overrides through this same model. The resolved
activity declares required completion verification by referencing its operation
bindings, without copying commands or parameter values. Missing or invalid values
produce a diagnostic naming the binding and field. Interpolate values as executable
arguments, not shell code. Invocation values cannot rewrite the executable or expand
ownership, confinement or network authority outside the approved declaration.
Host-supplied identity values cannot be replaced by model arguments. The execution
provider independently controls built-in web access.

Validate deterministically and offline. Check ownership, public import boundaries,
cycles, profiles, operations, guidance metadata and contract digests through the shared validation service. The resolved model records
trusted plugin identities and their composition. Load it at run admission and
reload it after every applied approved architecture update. Merge permitted object
properties recursively; explicitly supplied scalars and arrays replace defaults,
including empty arrays. Activities do not inherit implicitly, and ownership and
authority stay explicit. Record provenance and reject unresolved references. Proposal records go through the
coordination writer and remain separate from accepted authority. Model checked-edit
tools refuse locked files and the registry. An explicit architect delegation may
name an editor or the trusted host to apply an exact reviewed proposal on the
issue-linked task branch. The host-only application capability checks the proposal,
human approval, original content digests and intended resulting bytes together.
It is never exposed as an agent tool, and a candidate-side approval or registry
change cannot authorize it.

The Architecture Agent assesses approved objectives and goals, the current model
and implementation, and relevant journal observations and Reviewer lessons. It
returns a justified no-change assessment or one exact proposed change batch with
its purpose and consequences. Research is optional. Unknown or absent approval
leaves that proposal pending. Changed proposal bytes or architectural intent
require renewed approval; implementation repair within accepted intent does not.

When approved architecture needs prerequisite implementation, Workflow delivers
that work and the approved architecture together through its normal Director,
steward, independent verification and staging boundaries inside the Architect
phase. Validation refuses activation of an unavailable operation or handler.
After exact approved host application and validation of the required implementation,
Workflow can adopt the resolved model at an activity boundary within the same run,
including while finishing Architect prerequisites. An in-flight activation finishes
or is cancelled first. Revalidate pending work, original acceptance, ownership,
operations and affected evidence together before the next activation. Record the
approval, previous and new model identities and any validated runtime adoption;
never infer permission from candidate edits. Historical activations retain their
original model identity. Unavailable handlers prevent adoption. The combined
candidate still requires independent verification and staging delivery. Run begins
with the model of that accepted delivery. A changed proposal baseline requires
reconciliation and a newly reviewable proposal rather than silently rebasing
protected edits.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| ARC-1 | `load` on the current tree resolves the catalog with one version per family and reports zero findings. |
| ARC-2 | A component file at a foreign version produces a finding naming the file and version; no reader attempts to interpret it. |
| ARC-3 | Validation of a maintained path with zero or two owners fails and names the path. |
| ARC-4 | Two components declaring overlapping roots are refused with both ids named. |
| ARC-5 | A private-module import across owners fails `importsAllowed`; the same import through a declared public module passes. |
| ARC-6 | An import cycle among maintained modules is reported with the cycle path. |
| ARC-7 | Two `capture` calls on the same revision produce identical digests; a catalog edit between them does not change the first snapshot. |
| ARC-8 | An unapproved candidate edit cannot change the resolved authority. After exact approved host application and validated adoption, the same run uses the new model for its next activity and retains the previous model for historical observations. |
| ARC-9 | The request includes the acting owner's relevant fields, selected activity, and a compact catalog index. It names withheld inputs, references contracts, and leaves other activity definitions and Codex-discovered guidance out of the prompt. |
| ARC-10 | Requesting a full definition returns it complete; standards are selected for the activity and returned completely, without application-imposed size caps or truncation. |
| ARC-11 | Validation flags a changed locked digest, missing accepted file or missing record of architectural authority. |
| ARC-12 | A product checked edit of a locked file or its registry is refused. A candidate-side registry modification cannot unlock an existing capture. |
| ARC-13 | `operationsFor` returns only operations whose activity matches, with captured definitions, prerequisites and tool schemas. Activation exposes the same bindings as inspection. |
| ARC-14 | A missing binding key fails naming the key; setting `PATH` does not satisfy it. |
| ARC-15 | Proposing an architecture change records the exact proposal and leaves source byte-identical. Only a recorded human delegation to apply that exact proposal can enable the trusted host application path; model checked edits remain refused. |
| ARC-16 | Validation on an unchanged tree produces byte-identical finding output. |
| ARC-17 | The resolved model identifies each composed plugin. A candidate cannot replace trusted composition. A recorded approved model transition and validated runtime adoption can update subsequent activations without changing an in-flight invocation or historical evidence. |
| ARC-18 | An explicitly empty list stays empty. A missing activity remains unavailable. Omitting a required field or referencing an unknown role, profile, operation or standard produces a finding. |
| ARC-19 | The director and independent verifier resolve their role and profile from their own explicitly selected component activity. |
| ARC-20 | The Architecture Agent uses its explicitly mapped activity, can request optional research, and returns a source-linked no-change assessment or one purpose, consequences and exact diff batch. |
| ARC-21 | Host application refuses missing, declined, forged or stale approval, changed expected content, and bytes outside the approved batch. The journal retains the approval and original failed observations. |
| ARC-22 | Architect delivers required implementation and approved architecture together through independent verification and staging. Once exact approved application and implementation validation permit adoption, its next prerequisite activity can use the new model in the same run. Unavailable handlers block adoption; Run uses the accepted delivery. |
| ARC-23 | The same resolver applies permitted defaults and overrides deterministically, preserves explicit empty arrays and provenance, and refuses an implicit activity or ambiguous ownership. |
| ARC-24 | Different components and activities reuse one operation with typed parameter overrides. Inspection and activation expose identical resolved arguments; unknown parameters, invalid types and authority-expanding invocation values are refused. |
| ARC-25 | Each activity names completion verification through its operation bindings. The resolved model rejects a missing binding or unavailable handler rather than activating a declaration alone. |
