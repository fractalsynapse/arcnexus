# Interface contracts

The [registry](registry.yaml) indexes proposed and locked interfaces and their
owners. The architect accepts a proposed contract before it becomes locked. [Project](arcnexus-project.md) and [production authority](../../packages/release/contract.md)
apply across packages. Each plugin contract lives beside its public entry,
implementation, documentation and tests. The registry locates it.

A contract states the obligations dependents can observe. Its scenario IDs anchor
acceptance and survive implementation changes. Deferred scenarios are outside the
first build. Keep changed scenarios and text together with the architect's decision.

Before changing the repository, identify the governing clauses and verify that the
request fits them. On conflict, state the clause and the consequence, propose a
change to the request or contract, and wait for the architect's decision. The
architect alone accepts, changes or supersedes a lock. A named delegation can
authorize an editor to apply the specified change on a review branch. Agent checked edits refuse locked files and the registry. An exact recorded
human delegation can name the trusted host as the editor for an Architecture
proposal inside the automated Architect phase. Host application verifies the
approved baseline and bytes and leaves active captured authority unchanged.

On an authorized change, retain the previous digest and path in registry history,
record acceptance and the reason, and recompute the digest from the accepted bytes.
The restart's approval and prior identities are recorded in the registry.
