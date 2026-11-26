---
id: cordis-interfaces
priority: 100
---

# Preserve public interfaces through Cordis composition

Implement public application and service interfaces through Cordis plugins. Keep each reusable plugin's public entry, contract, implementation, documentation, tests and local scripts together. Consumers use public entries and shared definitions; private helpers remain local. Keep shared material and build/test entries at project scope.

Reuse application services across adapters. Introduce seams for actual consumers or independently replaceable responsibilities. Retain the first build's trusted CLI composition captured for each task; production hot reload, external plugin installation, alternate launch modes and clustered hosting remain deferred.

## Success measures

- Public interfaces resolve to implementing plugins and consumers use their public entries.
- Local and shared resources follow their respective boundaries.
- Trusted composition can substitute a plugin without changing its consumer.
- Adapters reuse service definitions, shared verification entries and captured composition identities.
