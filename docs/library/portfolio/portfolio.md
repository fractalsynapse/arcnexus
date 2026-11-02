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
