# Project contract — ArcNexus

Type contract: `project`. Stage: **locked** (revision 3). Owner: `architecture-maintenance`.
Supersedes: the `platform` and `package` component types, `architecture/environment.yaml`,
`architecture/composition-profiles/`, and portfolio registration as a concept a user must
learn.

## Identity

A **project** is one Git repository, one `.arc/` knowledge root, one component catalog, one
check catalog and one execution lane. It is the unit a caller points ArcNexus at and the unit
an agent stewards.

| Field | ArcNexus value | Rule |
| --- | --- | --- |
| id | `arcnexus` | stable; qualified as `<project>` or `<project>/<component>` |
| remote | `https://github.com/fractalsynapse/arcnexus.git` | HTTPS; verified identity, never inferred from a directory name |
| base branch | `staging` | new work branches from its current tip |
| protected branch | `main` | human-only merge, tag and publication |
| work branch | `<issue>-<description>` | one issue per branch; the convention names the work, never the tool or agent that performs it |
| knowledge root | `.arc/` | `architecture/` human, `plans/` and `learning/` agents |
| store | one SQLite file per project in application storage, keyed by verified repository identity | one store, one lane |
| bindings | `.git/arcnexus/bindings.yaml` | machine-local, outside committed source authority |

## Depends on

Nothing. This is the root of the contract graph.

## Provides

Every other contract consumes the resolved project view. These are the eight things a project
owes:

1. **`resolve(path)`** — from any directory inside the repository, the project and the
   component that owns that path. Ambiguity or no match is an input error, never a guess.
2. **`components()`** — the catalog: id, type, purpose, objectives with measures, constraints
   with measures, owned paths, declared public modules, role, execution profile, activity
   profile map, standards and operations.
3. **`ownerFor(path)`** — exactly one owner for every tracked maintained path, or a finding.
   Read access is the whole project; write access is the owner's declared paths plus its own
   documentation and a changelog entry.
4. **`checks(owner?)`** — the operation catalog and test-profile selection: owner-scoped setup,
   build, lint, format-check and suites; assembled repository checks. Each check declares what
   a passing result proves and which environment it needs.
5. **`profiles()`** — execution profiles (`model`, `reasoning`, `webSearch`, operation
   categories) plus the director profile, the reviewer profile and the engineering default.
6. **`deliveryPolicy()`** — base and protected branches, work-branch convention, the single
   publish target, required gates (CI, review), and the actions reserved to humans.
7. **`bindings()`** — resolved executables and repository paths for this machine, with their
   source recorded in evidence.
8. **`capture()`** — an immutable authority snapshot taken at admission: architecture,
   guidance, standards, checks, delivery policy, bindings identity and base revision.

The knowledge spaces are part of the contract because their authorship is observable behaviour:
`.arc/architecture/` is read as authority, `.arc/plans/` is authored by the owning agents and persisted only by the runtime lane, and
`.arc/learning/` is append-only and never authority for an active run.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | One project = one repository = one sequential lane = one store. Concurrency means more projects, not a scheduler. |
| I2 | Project identity comes from the verified remote. A directory name is not identity. |
| I3 | Every tracked maintained path resolves to exactly one owner. |
| I4 | Authority is captured at admission. Candidate edits to architecture, guidance, standards, checks or permissions cannot change the active run. |
| I5 | New work requires a clean committed checkout at the captured revision. Drift is an input error that writes no state. |
| I6 | Exactly one publish grant with one target branch. A second grant is a finding. |
| I7 | Bindings and credentials live outside source. A missing binding names the binding; it is never inferred from `PATH`. |
| I8 | One configuration version. A file at another version is a finding with a stated reason, not a migration path. |
| I9 | Plans and learning are agent-authored and never grant authority or weaken acceptance. |
| I10 | Merging to the protected branch, tagging, publishing and contract locks are human-only. |

## Acceptance scenarios

Each becomes one deterministic test in the owning suite during cleanup.

| Id | Given / when / then |
| --- | --- |
| PRJ-1 | Resolve from a nested directory returns the project and the deepest applicable component; an unrelated directory returns an input error naming what was missing. |
| PRJ-2 | Two equally applicable components for one path is an input error, not a tie-break. |
| PRJ-3 | A tracked maintained path with zero owners or two owners fails validation, naming the path. |
| PRJ-4 | Editing `.arc/architecture/` after admission does not change the active run's captured catalog; the next run sees the edit. |
| PRJ-5 | A dirty working tree or a HEAD that differs from the captured base is refused before any store row is written. |
| PRJ-6 | Two `delivery.publish` grants fail validation with the owner and file named. |
| PRJ-7 | A missing executable binding fails with the binding name; setting `PATH` does not satisfy it. |
| PRJ-8 | A configuration file at a non-current version produces a finding, and no reader attempts to interpret it. |
| PRJ-9 | A plan or learning file that grants a permission, widens a scope or weakens a check is rejected as authority. |
| PRJ-10 | Two projects on one machine get separate stores and lanes; neither observes the other's state. |
| PRJ-11 | Identity is verified from the remote URL: a renamed local clone still resolves to the same project. |
| PRJ-12 | A run that dies leaves its branch, workspace and evidence; a new run reads the recorded position rather than replaying an uncertain operation. |

## Migration

| Current concept | Becomes | Fate |
| --- | --- | --- |
| `architecture/components/arcnexus.yaml` (platform) + `cli-package.yaml` (package) | one `.arc/architecture/project.yaml` | merged; the `package` type disappears |
| `architecture/environment.yaml` (primary + dependencies) | project `repositories` (one entry for the MVP) | folded in; multi-repo composition deferred |
| `architecture/composition-profiles/local.yaml` | project `members` | concept removed |
| portfolio store: repositories, registrations, materializations, architecture mutations | one project record in application storage | materialization, clone checkpoints and registry locking deleted |
| `arcnexus platform` / `package` / `portfolio` commands | `arcnexus project` resource commands | replaced |
| execution profiles, roles, standards, operations, test profiles | unchanged shape, relocated under `.arc/architecture/` | retained |
| `.git/arcnexus/bindings.yaml` | unchanged | retained |
| `verificationInputs`, `director`, `reviewerProfile`, `defaultPackage`, `testProfile` | project fields `checks`, `director`, `reviewer`, `testProfile` | retained, `defaultPackage` dropped |

Migration is a single batch: introduce the project definition, move the source, delete the
package and portfolio machinery, and update the gateway commands. No compatibility reader and
no dual vocabulary: the old names are removed in the same change that adds the new ones.

## Non-goals

Multi-package and cross-repository composition, portfolio management, registry locking,
repository materialization, remote project registration, and any notion of a package distinct
from a project. If a future project needs several packages, it is several projects until a
demonstrated requirement says otherwise.

## Open items for later contracts

- The runtime currently creates execution branches named `codex/run-<id>` inside managed
  workspaces. That is an internal artifact of the execution engine, not the delivery
  convention fixed above, and its naming is decided by the `execution` library contract. The
  rule that a branch name must not encode which harness performed the work applies there too.
- Repository branch-protection settings may still restrict branch patterns. Changing a
  protection rule is a human action; the contract states the convention, not the permission.

## Lock record

```yaml
id: arcnexus/project
stage: locked
revision: 3
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 3: plan content is authored by the owning agent and persisted only by the runtime lane, matching the single write path; the header is corrected to locked, which the registry already recorded.
  - revision 2: locked; work branch convention changed to <issue>-<description> so branch
    names do not encode the tool performing the work, and execution-branch naming was
    assigned to the execution library contract
  - revision 1: proposed in #346
```
