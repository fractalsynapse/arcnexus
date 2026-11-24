# Data SDK

Stage · **Proposed**.

The Data plugin exposes model operations contributed by trusted owning
plugins. Each resource has one registration. Its operations own their input
and output schemas. Trusted callers attach an authenticated principal and
verified project scope. One authorization decision governs discovery and
invocation. Model handlers receive validated input and retain responsibility
for domain authority and persistence.

An adapter can invoke a known operation through its typed resource definition
or use a runtime resource and operation name with the same validation path.
HTTP and MCP descriptions derive from the declared schemas. Removing a
registration removes its discovery entry and runtime method.

See the [gateway proposal](../../docs/plans/mockup/architecture-proposals/data-sdk-and-gateways.md)
and the [Commands contract](../commands/contract.md).
