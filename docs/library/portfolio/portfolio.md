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
