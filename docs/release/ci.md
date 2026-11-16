# Continuous integration

Applicable CI and configured review gate integration to staging. Checks use the
same build and verification entry points as local work. The
[Foundation contract](../../packages/foundation/contract.md) defines their
obligations. Keep deterministic, host enforcement and live model evidence separate.

The [Development workflow](../../.github/workflows/development.yaml) verifies pull
requests targeting `staging`, and the
[Staging workflow](../../.github/workflows/staging.yaml) verifies pushes to
`staging`. Both invoke the shared verification workflow.

Run `node packages/foundation/scripts/check-specification.mjs` to check the
tracked catalog, ownership, contract digests and scenarios, documentation links,
and skill metadata. The shared verification workflow always runs specification
checks. When tracked product source or tests exist, it also runs format, lint,
type checking and compiled tests through `npm test`. The test command builds
before running the compiled suites. CI records this deterministic evidence
separately from native host and live-agent qualification.

## Native confinement checks

Run `ARCNEXUS_NATIVE_TESTS=1 npm test` to enable native confinement tests.
The Bubblewrap test is skipped by default in CI unless native tests are enabled
with `ARCNEXUS_NATIVE_TESTS=1`.
