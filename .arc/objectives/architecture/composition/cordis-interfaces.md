---
id: "cordis-interfaces"
---

# Preserve public interfaces through Cordis composition

Implement public application and service interfaces through Cordis plugins. Keep each reusable plugin's public entry, contract, implementation, documentation, tests and owner-specific scripts together in `packages/<plugin>/`. Consumers use its public entry; private helpers remain local. Keep shared documentation and scripts at project scope and retain one shared build and test entry.

Let the CLI app own its terminal adapter and trusted plugin composition. Share application services across adapters, including structured Commands operations, and define each responsibility once for consumers to reuse directly. Use the least code that meets the accepted outcome; introduce service seams for actual consumers or independently replaceable responsibilities.

For the first build, retain one trusted CLI composition captured for each task. Keep production hot reload, external plugin installation, alternate launch modes and clustered hosting deferred.

## Observable success

- Public interfaces resolve to their implementing plugins, and consumers access packages through their public entries.
- Plugin-local contracts, documentation, tests and scripts remain beside their implementation; shared material remains at project scope.
- The CLI can substitute a trusted plugin at composition without changing a consuming plugin.
- Adapter composition reuses shared service definitions instead of duplicating responsibilities.
- Build and test execution use the shared project entries, and task records identify the captured trusted composition.