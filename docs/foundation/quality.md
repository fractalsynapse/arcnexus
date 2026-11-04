# TypeScript and code quality

Maintained code follows this development contract. Local development, steward
feedback and CI share the same standards; engineering checks use owner scope and
assembled deliveries run the full repository checks.

Maintained application code, tests and executable tooling use TypeScript. Test
suites use cohesive classes with explicit fixture lifecycle and scenario methods.
Production classes own dependencies or lifecycle state; pure helpers remain small
functions. Public CLI behavior and production construction-path tests are preserved.

`npm run check` preserves strict compiler checking and includes tests/tooling.
Linting is syntax-based and does not require TypeScript type analysis. Explicit
`any` remains allowed; do not replace useful work with exhaustive annotation rules.

## Commands

- `npm run format` formats maintained files; `npm run format:check` checks them.
- `npm run lint` checks maintained code without changing it.
- `npm run lint:fix` applies supported fixes within the caller-selected checkout.
- `npm test` builds the application and TypeScript tests, then runs Node acceptance.

Formatted code has at most 500 physical lines per file and 30 per function, method,
constructor or callback, counting comments and blank lines. Inline suppression of
size and ownership checks is prohibited. Generated artifacts, dependencies,
lockfiles, external payloads and retained historical evidence are excluded.
Split responsibilities rather than compressing lines or adding trivial wrappers.

## Steward integration

Engineering checkpoints use the inherited owner lint and formatting operations and
suites selected from the owner's captured test profile. Formatting intersects owned
paths with the repository's existing formatting coverage, defined once in
`scripts/foundation/format-check.mjs`. An owner without suites records that its
implicit profile check is not applicable; it does not report a passing test.

Assembled deliveries run the full captured repository checks, including formatting,
lint, strict types, tests and architecture/guidance validation. Agent-invoked checks
do not replace mandatory verification of the final candidate. Neither host checks
nor lint operations silently format or modify source; a steward may fix only its
originally captured writable scope. Active runs retain their captured policy.

CI checks formatting, lint, ownership, types, build, guidance and deterministic
acceptance. Its test-infrastructure watchdog is separate from application execution
limits. Candidate guidance/configuration edits cannot weaken captured host checks.

The lint configuration uses the syntax-only
[typescript-eslint recommended configuration](https://typescript-eslint.io/users/configs/).
The [ESLint function-length rule](https://eslint.org/docs/latest/rules/max-lines-per-function)
is exercised against ordinary functions, callbacks and TypeScript constructors.
Do not enable a typed-lint preset merely to preserve compiler checking; the two
checks are independent.

## Compiled fixture payloads

Maintain executable fixture sources as TypeScript (`.mts` where the target contract
uses ESM `.mjs` filenames). `npm run build` compiles them into `.fixture-build`,
separately from application and test output. Qualification setup materializes the
compiled payload together with the fixture's configuration and documentation before
creating its pinned Git revision. Do not copy raw fixture source directories into a
qualification target or run their uncompiled tests directly.

This preserves existing target contracts and tests the actual compiled programs.
The fixture catalog and supervising-build hash include the compiled payload; a
missing build is an explicit preparation error. Maintained fixture source participates
in type checking, formatting and linting. Generated payloads are ignored, disposable
outputs, and never widen a steward's source permissions.

Existing acceptance-script paths remain compatibility launchers. Current experiment
definitions capture the standalone compiled checks from `dist/library/experiments/checks`,
including any declared dependencies, so execution does not depend on mutable source
launchers. The directory-permission acceptance probe uses the installed Node runtime.

Pinned qualification revisions retain their original file layouts. Standalone acceptance
checks support both the historical flat report paths and the current owner directories,
without changing the required report behavior or rewriting pinned inputs. Guidance
acceptance resolves the maintenance reference for the target layout.

## Readability checks

The integrated syntax rules require class/method documentation headers and blank
lines between declarations and methods. They cover constructors and concrete object
methods as well as class methods. Inline suppression is disabled. See the
[readable TypeScript standard](typescript-standard.md) for comment examples and
review criteria; lint cannot decide whether an explanation is useful.

Delivery verification is shared by `development.yaml`, `staging.yaml` and
`production.yaml`. See [delivery verification](../release/verification.md).

## Confined build output

Production builds remove stale files and links inside the declared `dist` output
root while preserving its directory structure. The root and empty nested runtime
directories may be sandbox mounts beneath
read-only maintained source. Stale output links are removed without following them;
a missing root is created before compilation. Build failures retain their actual
compiler evidence and cannot grant write access to the source parent.

## Checked formatting proposals

The shared `component-format` agent operation formats the active owner's maintained
files in memory and returns a JSON `source.edit` request. It uses the same Prettier
configuration as the repository check. It does not write source, stage files or
apply its own output. Each proposed update includes the repository-relative path,
current SHA-256 and replacement content; unchanged, ignored and unsupported files
produce no update. Duplicate owned roots do not produce duplicate edits.

The steward submits the proposal through `source.edit` during a write-enabled turn.
The host checks component ownership, edit safety and current content. Formatting output grants no new
authority. A stale proposal requires recomputation; an identical retry retains its
transaction identity. Final `format:check` remains independent verification.

## Dependency bootstrap

The captured setup operation invokes `scripts/foundation/install-dependencies.mjs`.
It validates the version-three lockfile, caches applicable HTTPS artifacts
sequentially, then runs `npm ci --offline --no-audit --no-fund`. npm retains
lockfile integrity enforcement. Package lifecycle hooks run inside the same
source-read-only operation sandbox. Unsupported dependency sources fail before
any download; individual download failures are not retried automatically.

This pre-install bootstrap is JavaScript because it must run before TypeScript
is installed, including on Node builds without built-in type stripping. JSDoc
annotations and the strict tooling TypeScript check cover it. Application code
and acceptance scenarios retain the TypeScript standard.
