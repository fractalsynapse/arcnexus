# ArcNexus

ArcNexus helps a human architect direct software engineering and verify what changed.
ArcNexus itself is an early target.

The CLI is being rebuilt around Cordis plugins. The first commands are `inspect`,
which previews the context ArcNexus supplies to Codex, and `task run`, which carries
a goal through verified staging integration.

Start with the [charter](docs/charter.md) and [development direction](docs/dev.md).
[Architecture](packages/architecture/contract.md) stewards the project catalog and
contract records. The [contract registry](docs/interface/registry.yaml) identifies the accepted
interfaces and their owner locations.
