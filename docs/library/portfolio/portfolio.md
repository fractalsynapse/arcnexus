# Managed portfolio

Issue #148 introduces managed-volume services behind the CLI and future HTTP gateway.
The first vertical slice registers existing architectural platforms/packages, resolves
qualified identities outside a checkout, and retains data when unregistering.
Repository creation/templates, architecture transactions and run targeting follow
through these same services; registration alone is not complete portfolio delivery.

`ARCNEXUS_VOLUME` selects an explicit volume. Otherwise application configuration's
`volume` setting selects it, defaulting to XDG data storage under arcnexus. Application
configuration lives under XDG config storage and contains no architectural policy or
credentials. `config get/update volume` reads or changes this application setting.
An environment override wins and is visible in the effective result.

Settings reads include a deterministic `revision` without creating storage. Shared
application callers may pass that token as the third argument to
`ApplicationSettings.update(name, value, expectedRevision)`. A stale token fails
before replacing configuration. Updates hold the existing SQLite writer lease through
validation and atomic JSON replacement; failed mutations release it. The revision
includes both the effective environment override and the configured value, so an
override cannot conceal an intervening configuration change. The CLI keeps
`config update <name> <value>`; revision-aware API adapters use the shared service.

The coordination store owns a versioned portfolio SQLite database. Repository records
contain stable UUIDs and managed-relative or attached-absolute storage locations.
Registration records locate component definitions; they do not copy purposes,
policies, membership or standards. Reads derive those facts from committed source.
Read-only list/get opens no execution host and does not initialize an absent volume.

Existing local paths attach without copying or changing their source. Linked worktrees
share one repository registration through canonical Git identity. Remote materialization
uses host-managed Git and journaled recovery before the registration becomes visible.
Qualified package references are platform/package; short references fail on ambiguity.
Unregistering checks references and active execution and retains source/evidence.

Acceptance begins with built CLI registration/list/get from outside a repository,
shared repository identity, restart/volume relocation, ambiguity, stale revision and
non-destructive removal. No test may substitute an independent fake portfolio backend
for the production application service.

Registered packages can be validated from any directory with `validate platform/package`.
The service resolves the registered committed source and includes tracked guidance
findings in the same validation report. A unique short package reference is accepted;
ambiguous references fail. With no package argument, validation uses the current local
repository. Validation does not start an execution host or mutate registrations.
The existing `--project` path form remains a temporary migration adapter and cannot
be combined with a registered package argument.

## Managed materialization increment

A supplied HTTPS or file URL identifies an existing remote to materialize under
`repositories/<durable-id>/source` in the project volume. Local paths still attach.
Git runs under the existing parent-aware supervisor and delegated process scope.
The application supplies fixed arguments, disables hooks and ambient Git configuration,
and rejects embedded credentials and unsupported transport schemes. This operation
only reads the remote; it cannot provision or push to it.

The coordination store records materialization intent before dispatch and captures
command evidence under the same durable repository identity. Registration is visible
only after cloning, committed catalog validation and the final transactional update.
Repeated creation reuses completed matching materialization. An unfinished or failed
materialization requires reconciliation and cannot silently clone again. Source,
logs and failure evidence are retained, including on cancellation. Managed locations
are volume-relative; moving the entire volume preserves identities and reads.

This increment does not yet create projects without architectural input, apply
templates, change remote destinations or compose separate platform/package repositories.

Managed local projects use environment schema 5. It retains the shared-operation
composition contract and permits omitting the primary repository URL when there is
no declared upstream. A present primary URL remains an enforced origin constraint;
absence grants no publication destination. The registered repository UUID and
captured Git revision supply local identity. Dependency origins remain explicit.
Schema 4 retains its original HTTPS requirement and remains supported. Inspection,
preparation, test selection, cleanup and migration recognize schema 5 without changing
historical evidence or inventing an upstream. File URLs used to materialize source
belong to the host's journal, not duplicated architectural configuration.

Recovery may finish registration from a recorded successful clone checkpoint when
its committed revision remains unchanged. This validates the retained catalog and
performs no new Git clone. Pending/uncertain commands remain blocked for reconciliation.

## Package targeting

The portfolio service resolves a registered package reference or unambiguous local
package to an explicit source revision and package identity. Local discovery reuses
the architecture package-selection rules; it does not require director activation.
Read-only callers receive that target without starting a host, changing directories or
creating absent volume storage. Test commands consume it through shared test services.

## Shared list queries

Platform and package lists accept `field=value` equality filters plus
`--search`, `--limit` and `--cursor`, using the
same report query implementation as task/workday resources. Search covers identity
and purpose. Pagination returns a result revision and rejects stale or incompatible
cursors. Package platform selection remains an explicit namespace filter. List
queries never create an absent volume or start execution. Filters accept `id`,
`type` and `repositoryId`, combine with AND semantics, and reject unknown fields
or invalid types. In `package list [platform] [field=value...]`, a leading value
without `=` is the optional platform; subsequent values must be filters.

## Registered configuration migration

`config migrate [target] [--write]` accepts a registered platform or package (#167).
Qualified package references are preferred; short references must be unambiguous
across both resource types. With no target, migration uses the current repository.
Resolution reads repository registration without requiring old configuration to
validate as current executable architecture. The shared portfolio service returns
the existing migrator's structured diff, change count and retained evidence.

Preview leaves maintained source unchanged. Explicit `--write` applies the existing
validated clean-checkout migration to the selected repository, which can contain
multiple packages. It neither commits nor publishes. Historical execution authority
and evidence remain unchanged, and another successful invocation has no changes.
Unknown or ambiguous targets fail before migration creates a candidate.
If a registered definition has disappeared or changed type, reconcile the registration
before migration; a retained repository location does not authorize a different target.

## Execution storage (#193)

Application settings also resolve execution storage through the public settings
module. New execution defaults to `state/` inside the effective project volume.
Runs, candidates, workspaces and stable supervisor snapshots use that same root.
Read-only resource queries resolve paths without creating directories or hosts.

An explicit nonempty `ARCNEXUS_STATE_DIR` selects a separate state root, including
historical `${XDG_STATE_HOME:-~/.local/state}/arcnexus` evidence. Setting the volume
does not move, rewrite or combine retained databases. Existing hosts continue using
their captured root. Empty volume or state environment overrides fail as invalid
input instead of accidentally selecting the current directory.

Unregistering checks the selected volume, explicit state override and historical
state root for active execution. Changing settings does not authorize abandoning
an active run. This increment unifies storage selection; it does not make absolute
paths in retained run records portable or qualify container relocation/recovery.

## Transactional architectural updates (#197)

The update contract is `component update <package> <id> <field=value>...`,
`platform update <id> <field=value>...` and
`package update <package> <field=value>...`. The shared portfolio application service
owns repository serialization and authority selection; architecture owns definition
patching and validation, and the coordination store owns durable mutation intents.
Values for arrays, objects, booleans and numbers use JSON; ordinary strings need no
additional encoding. Duplicate fields, identity/schema changes and unknown or retired
fields fail before selecting any new authority. Full catalog validation includes
ownership, inherited policies and public boundaries, not only the patched schema.

Updates create local commits on an application-owned configuration branch using a
private index. They never stage or edit the caller's files, switch its branch, run
Git hooks or publish upstream. Registered resources in the same repository share the
selected revision. Registered execution targets capture it; local discovery continues
to mean the local checkout's committed revision. Existing runs retain their captured
revision. An external checkout advancing after selection requires explicit
reconciliation; its new content is never imported silently. Config migration refuses
to operate on a registered target whose selected revision differs from checkout HEAD.

Application mutations receive structured field maps; only the CLI parses `field=value`
arguments. Application mutations accept an expected resource revision. A stale token leaves the
selection unchanged. The canonical repository execution lease excludes host execution
and other mutations. A validated commit and intended branch transition are journaled
before the branch changes; selection and completion are committed together in SQLite.
Recovery accepts only the recorded previous or intended branch revision, validates the
retained commit, and finishes that exact transition. Unexpected branch state requires
attention and is retained. Symbolic configuration refs are rejected; ref updates never
follow a redirect into a caller branch. No external operation is retried by configuration
recovery.

These mutations support same-repository definitions. Multi-repository composition
and transactions remain pending capabilities of the managed lifecycle plan.

`component create <package> <id> <field=value>...` uses the same transaction path.
Supply `type`, `purpose` and `owns`; the service supplies schema version, identity
and the selected package as the default parent. Only executable component types
belong here. The proposed definition cannot collide with an existing identity or
file, overlap ownership, or leave its selected package. For example:

```sh
arcnexus component create studio/service metrics type=library \
  'purpose=Report service health' 'owns=["src/metrics","tests/metrics"]'
```

`component remove <package> <id>` removes only that executable definition. It does
not delete source or silently transfer ownership. Remaining maintained files,
children and references must resolve in the resulting catalog or removal fails.
Platform/package removal continues to use resource unregistration. Creation accepts
the current package revision for optimistic checks; removal accepts the current
component revision. Neither operation edits an attached checkout or changes the
authority of a retained run.

Managed simulation worktrees carry a host-written materialization snapshot in their
private Git metadata. Fresh `inspect`, registered validation and test-selection processes use
that snapshot to check the actual worktree revision and isolated origin against the
captured mapping. Declared upstream identities remain unchanged. A mismatched HEAD,
remote or worktree identity is an error; ordinary checkouts retain ordinary origin
checks. Offline local `validate` retains explicitly unavailable dependency inventories
when bindings are not supplied. The snapshot is not authored configuration and does not change active run
permissions or supply upstream credentials.

## Standard mutations

`standard create <platform> <id> <field=value>...`, `standard update` and
`standard remove` use the same validated configuration commits. Creation requires
`owner`, `purpose`, `applicability` and `document`; optional `examples` and
`operationIds` default to empty arrays. The owner must be executable within the
selected platform, documentation must exist in its scope, and checks must be
available to that owner. Updates cannot rename IDs or change schema versions.
Removing a standard still referenced by inherited policies fails without selecting
a new revision. Removing the definition does not remove its documentation.

Application callers use `Portfolio.changeStandard` with a structured field map
and optional expected revision. Create checks the platform revision; update and
remove check the standard revision. Missing artifacts, invalid references and
stale writes leave the selected authority and attached checkout unchanged.

## Repository migration contract (#238)

The next migration increment supplies `platform migrate <id> <repository>` and
`package migrate <package> <repository>` through the shared portfolio service.
An existing HTTPS/file remote (or local repository used as a remote) is cloned into
managed storage through the existing supervised, journaled materializer. Migration
never moves or edits the original checkout and never pushes upstream.

The destination must contain the selected source authority in its history and a
valid committed definition with the same resource identity and platform relation.
A behind or divergent destination requires reconciliation; migration does not
silently discard local/configuration commits or infer permission to publish them.
The entire resulting catalog is validated before registration changes. Other
resources sharing the old repository retain their current registrations.

Source and destination execution leases prevent competing repository mutation.
Active runs, pending configuration transitions and stale resource revisions block
transfer. The final registration and materialization transition commit atomically;
repeating a successful request preserves identity and revision. Failed validation
retains the clone and original registration; uncertain clones cannot be replayed.
Historical execution evidence remains associated with its original repository.
