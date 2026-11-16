# Architecture model plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Resolve and validate the project, owners, profiles, operations, standards, role
bindings, host bindings, delivery policy and contract registry. Expose one immutable
capture and one model-facing context builder to all callers. Supply the acting
component's complete definition and a compact catalog index. Name withheld inputs
and return requested definitions whole. Activity standards are shared references
and filtered to the activity. The reviewer receives the complete evidence bundle
under the verification contract.

A component may inherit a missing non-activity property from the project where
that property permits inheritance. Authority and owned roots stay explicit. Every
component authors its own activity map. Each activity declares role, profile,
instructions, operations and standards. An empty list explicitly contributes
nothing. A host activity declares the host as executor and carries no model profile.
An absent activity is unavailable. A partial mapping or unresolved reference is a
validation finding. Neither activities nor their fields inherit project defaults.
The project selects director and verifier by their component and explicit activity.
A role supplies standing instructions and owns no files or commands. Operation
declarations describe the act and its parameters, prerequisites and confinement.
The activity grants the declared operation. Invocation parameters cannot rewrite
the command or expand authority.

Validate deterministically and offline. Check ownership, public import boundaries,
cycles, profiles, operations, guidance metadata and contract digests through the shared validation service. Capture freezes
trusted plugin identities and their composition. Proposal records go through the
coordination writer into learning. Only an explicit architect delegation permits
an editor to apply a lock change on a repository review branch. Product runs and their checked-edit tools refuse locked files and the registry.
Architectural proposals are applied outside the active task on a review branch.

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
| ARC-8 | A candidate edit to `.arc/architecture/` during a run leaves that run's captured catalog and findings unchanged. |
| ARC-9 | The context includes the acting owner’s definition plus an index for other owners, stays within the bounded view, and names withheld inputs. |
| ARC-10 | Requesting a full definition returns it complete; standards for the activity are filtered and capped, and exceeding the cap is a finding against the standard, not a silent truncation. |
| ARC-11 | Validation flags a changed locked digest, missing accepted file or missing record of architectural authority. |
| ARC-12 | A product checked edit of a locked file or its registry is refused. A candidate-side registry modification cannot unlock an existing capture. |
| ARC-13 | `operationsFor` returns only operations whose activity matches, each with its digest and prerequisites resolved. |
| ARC-14 | A missing binding key fails naming the key; setting `PATH` does not satisfy it. |
| ARC-15 | `proposeChange` writes a proposal record and leaves `.arc/architecture/` byte-identical. |
| ARC-16 | Validation on an unchanged tree produces byte-identical finding output. |
| ARC-17 | A capture identifies each composed plugin. A changed target catalog or candidate plugin cannot replace one in the active capture. |
| ARC-18 | An explicitly empty list stays empty. A missing activity remains unavailable. Omitting a required field or referencing an unknown role, profile, operation or standard produces a finding. |
| ARC-19 | The director and independent verifier resolve their role and profile from their own explicitly selected component activity. |
