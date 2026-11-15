# ArcNexus project contract

Stage: **locked**. See the [registry](registry.yaml) for authority and history.

## Obligations

A project is one Git repository, one knowledge root, one component and check catalog,
one sequential lane, and one store. Resolve the project from a working directory and
verify the canonical Git remote. The project definition supplies its identity,
bindings, activity defaults and delivery policy. Credentials remain outside source.
Each component declares its purpose, measurable objectives and constraints, and
owned roots. Resolve its public plugin entry from the owning package.

Every public application or service interface is implemented through a Cordis plugin.
The CLI application composes the trusted plugins in `apps/cli/`. Each plugin has one owner
and keeps its public entry, interface, source, documentation, tests and owner-specific
scripts together in `packages/<plugin>/`. Root documentation and scripts serve the
whole project. A package exposes only its public entry. Private helpers remain local.

The architecture catalog is the only authored ownership map. Exactly one owner covers
each tracked maintained path. A steward has full project read access and writes only
owned paths through checked edits. The project owns cross-cutting governance. Its
authored rules and commands are reused by reference. Use the least code that meets the
accepted contract. Add a service seam for an actual consumer or a responsibility that
must be independently replaceable.

Admission freezes the catalog, authority, checks, revision, bindings identity and
trusted plugin composition. Commit and upstream authority belong to the host.
Target source cannot supply executable host plugins or change active composition.
`.arc/plans/` and `.arc/learning/` are generated records. They cannot grant authority.
Keep one configuration version. Main integration, tags and release remain human-controlled.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| PRJ-1 | Resolve from a nested directory returns the project and the deepest applicable component; an unrelated directory returns an input error naming what was missing. |
| PRJ-2 | Two equally applicable components for one path is an input error, not a tie-break. |
| PRJ-3 | A tracked maintained path with zero owners or two owners fails validation, naming the path. |
| PRJ-4 | Editing architecture, guidance or plugin selection after admission leaves the active capture unchanged. A later run reads the new approved inputs. |
| PRJ-5 | A dirty working tree or a HEAD that differs from the captured base is refused before any store row is written. |
| PRJ-6 | A second staging publication grant is a finding naming its owner and source. |
| PRJ-7 | A missing executable binding fails with the binding name; setting `PATH` does not satisfy it. |
| PRJ-8 | A configuration file at a non-current version produces a finding, and no reader attempts to interpret it. |
| PRJ-9 | A plan or learning file that grants a permission, widens a scope or weakens a check is rejected as authority. |
| PRJ-10 | Two projects on one machine get separate stores and lanes; neither observes the other's state. |
| PRJ-11 | Identity is verified from the remote URL: a renamed local clone still resolves to the same project. |
| PRJ-12 | A run that dies leaves its branch, workspace and evidence; a new run reads the recorded position rather than replaying an uncertain operation. |
| PRJ-13 | Moving an owner-local contract, test or script outside its owner root fails ownership validation. The CLI can substitute a trusted plugin at composition without changing a consuming plugin. |
| PRJ-14 | A target repository plugin declaration cannot execute privileged host code or replace the application composition. |
