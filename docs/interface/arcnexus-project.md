# ArcNexus project contract

Stage: **locked**. See the [registry](registry.yaml) for authority and history.

## Obligations

A project is one Git repository, one knowledge root, one component and check catalog,
one sequential lane, and one store. Resolve the project from a working directory and
verify the canonical Git remote. The project definition supplies its identity,
bindings, shared references and delivery policy. Credentials remain outside source.
The component types are project, app and plugin. Each declares its purpose,
measurable objectives and constraints, owned roots, and its activity map. An app
owns its composition, operator entry point and app-local tests. A plugin owns
its public entry and implements a reusable service or capability.

Every public application or service interface is implemented through a Cordis plugin.
The CLI app owns its transport contract in `apps/cli/` and composes trusted
plugins, including the shared Commands SDK. Each plugin has one owner
and keeps its public entry, interface, source, documentation, tests and owner-specific
scripts together in `packages/<plugin>/`. Root documentation and scripts serve the
whole project. A package exposes only its public entry. Private helpers remain local.

The architecture catalog is the only authored ownership map. Exactly one owner covers
each tracked maintained path. A steward has full project read access and writes only
owned paths through checked edits. The project owns cross-cutting governance. Its
authored rules and commands are reused by reference. Use the least code that meets the
accepted contract. Add a service seam for an actual consumer or a responsibility that
must be independently replaceable.

Before project execution admission, an authorized repository connection may pin a
verified Git revision and inspect its documentation through a trusted,
platform-owned read-only Planner binding. This discovery can retain draft
objectives and review observations under the same repository identity. It grants
no repository writes, project-declared tools or project execution authority.
Admission to publish objectives or align goals resolves the approved catalog,
authority, checks, revision, bindings identity and trusted plugin composition.
Reload that integrated model after every
applied human-approved architecture update at a recorded activity boundary, once
required implementation and handlers are validated. Revalidate retained work before
the next activation in the same run, preserving original acceptance and historical
evidence. An in-flight activation keeps its recorded model identity. Commit and
upstream authority belong to the host. Candidate source cannot authorize executable
host plugins or composition changes; adopting an updated runtime requires the
trusted host's recorded validation under the approved architectural authority.
`.arc/plans/` and `.arc/learning/` are generated records. They cannot grant authority.
Authored goals under the project knowledge root persist across rounds. Each goal
declares priority, requirements and observable measures. A round evaluates the
pinned inventory serially; an observation can establish that a measure already
holds on current staging. Keep one configuration version. Main integration, tags and release remain human-controlled.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| PRJ-1 | Resolve from a nested directory returns the project and the deepest applicable component; an unrelated directory returns an input error naming what was missing. |
| PRJ-2 | Two equally applicable components for one path is an input error, not a tie-break. |
| PRJ-3 | A tracked maintained path with zero owners or two owners fails validation, naming the path. |
| PRJ-4 | Unapproved architecture, guidance or plugin edits cannot change authority. An exact human-approved update, validated implementation and recorded host adoption can update the next activity in the same run. Historical observations retain their original model identity and original acceptance is preserved. |
| PRJ-5 | A dirty working tree or a HEAD that differs from the captured base is refused before any store row is written. |
| PRJ-6 | A second staging publication grant is a finding naming its owner and source. |
| PRJ-7 | A missing executable binding fails with the binding name; setting `PATH` does not satisfy it. |
| PRJ-8 | A configuration file at a non-current version produces a finding, and no reader attempts to interpret it. |
| PRJ-9 | A plan or learning file that grants a permission, widens a scope or weakens a check is rejected as authority. |
| PRJ-10 | Two projects on one machine get separate stores and lanes; neither observes the other's state. |
| PRJ-11 | Identity is verified from the remote URL: a renamed local clone still resolves to the same project. |
| PRJ-12 | A run that dies retains its branch, checkpoints and evidence. A new attempt reconciles the interrupted workspace and remote effects, removes the old task-owned worktree after preservation, and resumes at the first unfinished activity. |
| PRJ-13 | Moving an owner-local contract, test or script outside its owner root fails ownership validation. The CLI can substitute a trusted plugin at composition without changing a consuming plugin. |
| PRJ-14 | A target repository plugin declaration cannot execute privileged host code or replace the application composition. |
| PRJ-15 | The CLI app owns `apps/cli`, the Commands plugin owns `packages/commands`, and the project owner owns neither path. Both the app and plugin expose their own complete component specifications. |
| PRJ-16 | An authorized repository without an ArcNexus catalog can produce retained, revision-cited objective drafts. Its source and project authority remain intact. Project admission reuses the verified repository identity and retains the drafts and citations. |
