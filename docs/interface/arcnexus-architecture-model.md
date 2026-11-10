# Library contract — Architecture model

Type contract: `library`. Stage: **proposed**. Owner: `architecture-model` (absorbs
`architecture` and `guidance-validation`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-foundation.md`](arcnexus-foundation.md).
Depended on by: every other library contract, `direction`, `coordination`, `execution`,
`verification`, `delivery`, `report`, and the gateway.

The architecture model is the project's own description of itself: which components exist, what
each is for, who may write what, which rules apply to which activity, which operations are
declared, and what a run was authorized to do when it started. Nothing else in the system is
allowed to re-derive those facts.

## Identity

| Field | Value |
| --- | --- |
| component | `architecture-model` |
| paths | `src/library/architecture-model`, `tests/library/architecture-model`, `docs/library/architecture-model` |
| source read | `.arc/architecture/` (project, components, roles, execution profiles, standards, operations, delivery policy) and `.arc/architecture/plan-template.md` |
| current code | `src/library/architecture` (49 files, 5,754 lines) + `src/library/guidance-validation` (187 lines) |
| target code | ~10 modules, 1,200–1,400 lines |

## Provides

| Service | Obligation |
| --- | --- |
| `load(root, revision)` | the resolved catalog at **one** configuration version: project, components with ownership and measures, roles, execution profiles, standards, operations, test profile, delivery policy. Deterministic, offline, no model, no network. |
| `ownerFor(path)` / `coverage(inventory)` | exactly one owner per tracked maintained path, derived only from declared paths with ancestor inheritance. Reports unowned and multiply-owned paths by name. |
| `importsAllowed(file, target)` | the import boundary: cross-owner imports only through declared public modules, no private-module reach, no cycles. |
| `validate(catalog, inventory)` | findings with **stable codes**, each naming file and reason: architecture, ownership, guidance metadata, standards budgets, delivery policy, and contract integrity (below). Never a semantic judgement about prose quality. |
| `capture(...)` | the immutable authority snapshot taken at admission: catalog bytes and digests, guidance and standards digests, check catalog, bindings identity, base revision, and the digests of every `locked` contract. This is what "captured authority" means everywhere else. |
| `contextFor(component, activity, milestone?)` | the bounded model-facing view. The acting component's **own** definition arrives complete, because its ownership paths and verification operations are authority it cannot re-derive; every other component is a catalog index (id, purpose, objectives, constraints, one line each) unless explicitly requested. Standards are filtered to the activity and capped: at most six, about 150 words each. |
| `operationsFor(component, activity)` | declared operations available to that activity with their digests, prerequisites and generated-output declarations. Resolution only — running them belongs to `execution`. |
| `bindings(project)` | machine-local executables and repository paths, with the source recorded. A missing key is an error naming the key. |
| `proposeChange(component, field, value)` | writes a **proposal** for the architect into `.arc/learning/`. It never edits `.arc/architecture/` and never changes an active run. |

## Must never do

Decide execution authority, create or clean workspaces, generate plans, store evidence, call a
model, reach the network, migrate a configuration version, or expose platform, package,
composition-profile or portfolio concepts. Retaining a reader for an old version is not a
failure mode to design around: old evidence stays readable as data in application storage.

## Contract integrity — the enforcement this walk has been missing

Guidance and review have never been enough to keep an agent inside a boundary, so two checks
become part of this contract rather than a convention:

1. **Digest verification.** `validate` reads `docs/interface/registry.yaml`, recomputes each
   `locked` entry's digest, and reports a finding when the file differs from the record, when a
   locked entry has no acceptance, or when a locked contract gained a clause without a new
   registry revision.
2. **Admission refusal.** The `capture` snapshot carries the locked-contract digests. The
   checked-edit path in `execution` rejects any write targeting a locked contract file unless the
   run's captured authority includes a recorded human acceptance naming that contract id. The
   model supplies the facts; `execution` enforces them; neither reimplements the other.

Without (2) the walk is a document people mean to obey. With it, a run that crosses a locked
interface stops at the edit that would have done it.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | One configuration version. A file at another version is a finding with a reason; no reader interprets it. |
| I2 | Ownership comes from declared paths only. No per-milestone file grants, no access granted through another owner's request, no overlapping roots. |
| I3 | Every tracked maintained path has exactly one owner. |
| I4 | The capture is immutable for the run. Candidate edits to architecture, guidance, standards, checks or contracts cannot change it. |
| I5 | Validation is deterministic, offline and side-effect free; finding codes are stable across revisions. |
| I6 | Model-facing context is bounded by construction: index by default, full definition on request, standards within budget. No paging subsystem exists to cope with an unbounded catalog. |
| I7 | Guidance is validated as metadata and inventory; semantic approval stays with the reviewer. |
| I8 | Standards attach to activities, not to bespoke prompts, and are shared once per catalog rather than copied per owner. The set a context inherits is the project's and the component's own, narrowed to the activity being performed; activities order an agent's work as well as narrowing what it reads. |
| I9 | A locked contract cannot be modified by a candidate without recorded human authority. |
| I10 | The model reports what it withheld: any truncation, budget hit or unavailable definition is stated in the output, never silent. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| ARC-1 | `load` on the current tree resolves the catalog with one version per family and reports zero findings. |
| ARC-2 | A component file at a foreign version produces a finding naming the file and version; no reader attempts to interpret it. |
| ARC-3 | A tracked maintained path with zero or two owners is reported by path, and `validate` exits non-zero. |
| ARC-4 | Two components declaring overlapping roots are refused with both ids named. |
| ARC-5 | A private-module import across owners fails `importsAllowed`; the same import through a declared public module passes. |
| ARC-6 | An import cycle among maintained modules is reported with the cycle path. |
| ARC-7 | Two `capture` calls on the same revision produce identical digests; a catalog edit between them does not change the first snapshot. |
| ARC-8 | A candidate edit to `.arc/architecture/` during a run leaves that run's captured catalog and findings unchanged. |
| ARC-9 | `contextFor(component, activity)` returns the index without full definitions, stays within the stated bound, and names what it withheld. |
| ARC-10 | Requesting a full definition returns it complete; standards for the activity are filtered and capped, and exceeding the cap is a finding against the standard, not a silent truncation. |
| ARC-11 | `validate` flags a locked contract whose file digest differs from the registry entry, and a locked entry with no recorded acceptance. |
| ARC-12 | A checked edit targeting a locked contract file is refused for a run without recorded human authority, and permitted for one that carries it. |
| ARC-13 | `operationsFor` returns only operations whose activity matches, each with its digest and prerequisites resolved. |
| ARC-14 | A missing binding key fails naming the key; setting `PATH` does not satisfy it. |
| ARC-15 | `proposeChange` writes a proposal record and leaves `.arc/architecture/` byte-identical. |
| ARC-16 | `validate` run twice on an unchanged tree produces byte-identical output, so findings can be diffed. |

## Migration

| Deleted | Current cost | Reason |
| --- | --- | --- |
| `migration.ts`, `migration-draft.ts`, `migration-operations.ts`, `migration-policies.ts`, `migration-component.ts`, `migration-recipes.ts`, `migration-standards.ts`, `migration-authority.ts` | 8 files, 1,182 lines | one version, no migration |
| `component-v4.ts`, `component-v5.ts`, `component-v5-policy.ts` | 429 lines | readers for versions no live file uses |
| `schemas/component.json` (v1–3), `component-v4.json`, `component-v5.json`, `composition-profile.json`, `pattern.json`, `ownership.json` legacy variants | ~1,822 lines of schema | one schema family per kind |
| the `architecture.yaml` constraints that require preserving historical readers | 7 constraints | they currently make deletion a policy violation |
| `guidance-validation` as a component | 187 lines | absorbed as guidance findings inside `validate` |
| `catalog-view.ts`, `model-context.ts`, `component-resources.ts`, `inspection.ts`, `derived-api-cache.ts`, `api-imports.ts`, `import-symbols.ts`, `public-api.ts`, `directory-grants.ts`, `permissions.ts`, `file-classification.ts`, `captured-program.ts`, `captured-options.ts`, `repository-revisions.ts`, `revision-artifacts.ts`, `assignment-scope.ts`, `references.ts`, `configuration.ts`, `config.ts`, `initialization.ts`, `component-operation-plans.ts`, `materialization-bindings.ts`, `platform-execution.ts`, `contract-schemas.ts`, `component-paths.ts`, `component-update.ts`, `standard-update.ts`, `packaged-schemas.ts` | 28 modules | consolidated into `catalog`, `ownership`, `validation`, `capture`, `context`, `operations`, `bindings`, `standards`, `update`, `build` |

The `migrated-probe-*` and `migrated-recipe-*` operation files are renamed to real ids with
their commands intact, and the unreferenced probe file is deleted. `assignment.ts` splits: the
scope and capture parts move here, the workflow parts move to `direction`.

Migration lands as one batch with the Project contract, because both remove the platform and
package vocabulary; nothing is dual-spelled in between.

## Non-goals

Runtime caching layers, plugin discovery, architecture editing through the CLI, an architectural
DSL, conformance rules beyond what a deterministic check can prove, and any behaviour that
exists to keep old runs executable.

## Accepted decisions

1. **Contract integrity is split as proposed:** `architecture-model` performs digest
   verification inside `validate`; `execution` performs admission refusal on the checked-edit
   path. Neither reimplements the other.
2. **Editing `.arc/architecture/` is a human act applied from a proposal.** `proposeChange`
   writes the proposal; a human (or an agent a human explicitly delegates to) applies it. A UI,
   API and MCP editing surface comes later and will be a new gateway contract, not an extension
   of this one.
3. **Contract files belong to the component each contract describes** — see the protocol's
   ownership rule. This contract's file transfers to `architecture-model` when the ownership
   re-cut lands, and is held by architecture-maintenance until then.

## Lock record

```yaml
id: arcnexus/architecture-model
stage: locked
revision: 2
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 2: locked with the three open questions resolved by the architect — integrity split
    between architecture-model and execution, architecture editing stays a human act applied
    from a proposal, and contract files are owned by the component each describes
  - revision 1: proposed in #350
```
