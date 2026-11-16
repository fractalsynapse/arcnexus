# Continuous integration

Applicable CI and configured review gate integration to staging. Checks use the
same build and verification entry points as local work. The
[Foundation contract](../../packages/foundation/contract.md) defines their
obligations. Keep deterministic, host enforcement and live model evidence separate.

Run `node packages/foundation/scripts/check-specification.mjs` to check the
tracked catalog, ownership, contract digests and scenarios, documentation links,
and skill metadata. CI runs the same check. The specification-only revision has
no tracked product source or tests, so executable checks are inapplicable. With
tracked app or plugin source or tests, the shared workflow runs format, lint,
type-check and `npm test`. The test command builds before running the compiled
suites. CI records this deterministic evidence separately from native host and
live-agent qualification.
