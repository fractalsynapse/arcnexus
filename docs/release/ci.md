# Continuous integration

Applicable CI and configured review gate integration to staging. Checks use the
same build and verification entry points as local work. The
[Foundation contract](../../packages/foundation/contract.md) defines their
obligations. Keep deterministic, host enforcement and live model evidence separate.

Run `node packages/foundation/scripts/check-specification.mjs` to check the
tracked catalog, ownership, contract digests and scenarios, documentation links,
and skill metadata. CI runs the same check. The specification-only revision has
no tracked product source or tests, so executable formatting, lint and type
checks are inapplicable. CI runs those steps once source or tests are tracked
under an app or plugin, or in the legacy root source or test directories.
Report the checks that actually executed.
