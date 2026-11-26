---
id: readable-source
priority: 180
---

# Keep maintained code readable and consistently verified

Maintain strict TypeScript across product code, tests, fixtures, configuration and tooling, with JavaScript confined to generated output. Use cohesive classes for lifecycle state and collaborators, small pure transformations and thin entry points.

Keep purpose, invariants and material effects understandable through names, spacing and meaningful documentation headers. Preserve the approved limits of 500 physical lines per file and 30 per function, method, constructor or callback, including comments and blank lines. Do not evade them through compressed statements or meaningless wrappers.

Use shared build and verification entries. Read-only checks preserve maintained bytes; authorized fixes remain within captured scope. Required assembled verification remains distinct from local checks.

## Success measures

- Specification and strict type checks cover maintained source and tooling.
- Lint verifies headers, spacing and approved size constraints; independent review assesses explanatory quality.
- Read-only checks leave maintained source unchanged.
- Applicable assembled verification exercises built artifacts and production composition before delivery.
