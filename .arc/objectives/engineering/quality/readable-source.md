---
id: "readable-source"
---

# Keep maintained code readable and consistently verified

Maintain strict TypeScript across product code, tests, fixtures, configuration and tooling, with generated JavaScript confined to generated output. Use cohesive classes for lifecycle state and collaborators, small pure transformations and thin entry points.

Keep purpose, invariants and material effects understandable through names, spacing and meaningful documentation headers. Preserve the documented physical size limits of 500 lines per file and 30 per function, method, constructor or callback. Do not satisfy them through compressed statements or meaningless wrappers.

Use shared build and verification entries. Read-only checks preserve maintained bytes, and authorized fixes remain within captured writable scope. Required assembled verification remains distinct from local owner checks.

## Observable success

- Specification and type checks cover maintained source and tooling.
- Lint checks headers, spacing and size constraints; independent review assesses explanatory quality.
- Read-only checks leave source unchanged.
- Applicable assembled verification exercises the built artifact before delivery.