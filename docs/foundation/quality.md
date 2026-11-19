# Build and quality

The [Foundation contract](../../packages/foundation/contract.md) defines shared
entry points and acceptance. Apply the [readable TypeScript standard](typescript-standard.md)
to maintained code, tests and tooling.
Require documentation headers on TypeScript abstract methods under FND-4.

Keep each plugin's tests with its code. Select suites from the owner boundary and
declared test metadata. Work with the checks that resolve the current uncertainty.
Run applicable assembled checks on the built artifact and production composition
before delivery. Declare generated roots once. Read-only checks leave maintained
source untouched, and fixes remain in the caller's writable scope.
See [Continuous integration](../release/ci.md) for hosted checks and the opt-in local native confinement suite.

The first Foundation delivery compiles the app and plugin layout and exercises
Cordis composition through the built test path. Build output belongs in `dist/`.
Use one configuration for source, app and plugin tests, and shared tooling.

Put suites in the owning app or plugin under `tests/unit`, `tests/integration`
or `tests/acceptance`. The test runner derives the level and owner from that path
and the catalog. Run `npm test` for all suites or `npm test -- <owner>` for one
owner. Formatting and lint fixes take explicit owner paths.

Before running the optional `owner-tests` operation, ArcNexus checks for
suites in the steward's current worktree. An owner with no suites gets an
inapplicability record. Assembled verification still runs its required checks.

## Owner-scoped quality commands

The existing format/lint entry points implement optional-owner selection through
the public `selectQualityInputs` API in
[Foundation's entry](../../packages/foundation/src/index.ts).
This tooling does not by itself establish host progression or reusable evidence.
New operation mappings become available only after all prerequisite implementations
and the exact approved guide batch are delivered together inside Architect and
captured for subsequent work.

Under FND-7 and FND-10, `npm run format:check -- <owner>` and
`npm run lint -- <owner>` select the named component's applicable maintained
files. The owner is optional and must be validated against the component catalog.
Unknown owners, unowned maintained inputs and ownership collisions fail with
diagnostics identifying the owner or paths; they are not empty selections.
Extra arguments cannot broaden the selected scope.

Without an owner, retain the existing repository-wide coverage and strictness:
formatting covers root TypeScript/JSON and the existing app, package, script and
fixture extension patterns; lint retains ESLint's configured file coverage and
zero-warning requirement. Both forms invoke the existing Prettier or ESLint
executable and configuration with read-only flags. They neither invoke fixers nor
write maintained source. Existing explicit fix commands are separate from these
operations.

Engineering uses declared owner-scoped formatting/lint and test-profile-selected
suites, with applicable shared types/build checks. The assembled delivery retains
all five mandatory operations: `repository-build`, `repository-types`,
`repository-format`, `repository-lint` and `repository-tests`.
An engineering observation does not discharge an assembled requirement.

## Discovery and selection boundary

Shared discovery starts from the current worktree's maintained files, including
newly checked-created files before Git tracking, and excludes deleted, generated
and ignored inputs. Formatting and lint each intersect that inventory with their
own configured coverage and ignores; a shared inventory does not imply identical
operation selections. Reuse the existing coverage patterns, Prettier ignores and
ESLint configuration rather than maintaining parallel rules.

Resolve ownership through the public [Team boundary](../../packages/team/contract.md)
using captured component IDs and ownership roots. A candidate catalog cannot
widen the acting component's scope. For standalone commands use the current
catalog; for steward operations Execution must validate the worktree ownership
projection against the capture before discovery and confined invocation. Ownership
drift is a failure, even when the supplied owner argument still exists.

The shared `selectQualityInputs(operation, owner?)` path serves the
[command runner](../../packages/foundation/scripts/owner-quality.ts) and public
applicability consumers. Suite discovery omits non-test files, and built suites
cannot identify new source files; `check-specification`'s Git inventory also
cannot replace current maintained-file discovery. This is the reason for the
shared quality helper. It reuses Team ownership without copying suite registration,
changing the owner-test inventory or creating another inventory store.

`QualitySelection` returns `operation` (`format:check` or `lint`), optional
`owner`, sorted repository-relative `files` and `identity`. An empty `files`
array describes only that operation's selection. The runner prints the operation,
owner or repository scope, identity, input count and a separately labelled
`content-sha256`; for an empty selection it reports
`no applicable maintained files` without invoking the tool.

The current `identity` is a SHA-256 digest combining selection facts with bounded
source/configuration hashing. Its selection portion records operation, owner,
selected paths and their Team resolutions. Its additional inputs are selected
file bytes, all component YAML files, package and lock files, the selector and
runner source, root `.eslintignore` and `.prettierignore`, existing
`.gitignore` and `.editorconfig` files along selected paths, conventional
Prettier configuration paths for formatting, and `eslint.config.ts` with
recognised relative imports for lint. Inputs are sorted and deduplicated;
collected paths distinguish missing from present content.

This is bounded identity coverage, not complete relevant-input provenance.
Formatter configuration collection uses a conventional filename list and omits
empty files from that collection. Lint dependency collection uses a static-import
regular expression and a short extension list; it does not resolve every dynamic,
package, re-export or arbitrary filesystem dependency. Ignore/editor collection
follows selected paths, so the digest alone cannot establish all discovery inputs
that could make a formerly excluded or empty selection applicable. Hashing all
component YAML also includes fields unrelated to ownership. Neither this digest
nor the runner's selected-content digest proves captured authority, expectation or
environment identity. The
[architectural identity boundary](../../packages/architecture/quality-identity-boundary.md)
explains the F-3/E-1/E-4 division and retained regression evidence.

Foundation supplies selection facts to the existing host evidence boundary;
F-3 does not require a second general dependency analyser or evidence store.
Execution must validate current component IDs and ownership roots against captured
ownership before discovery, confined execution and reuse. It must establish
applicability/command selection parity, including matching cwd and configuration,
and perform current discovery for new/deleted files and formerly empty selections.
An owner argument or this digest alone cannot establish those guarantees.

Before progression or reuse, Execution must bind relevant source/discovery,
coverage, ignore and configuration/dependency inputs, selector/runner and
toolchain inputs, captured operation authority, arguments/cwd, activity,
expectation and environment. Changed relevant inputs require another observation.
Known unchanged relevant inputs must support scoped reuse after unrelated owner
or generated-output edits. Where relevance is unknown, decline reuse and observe
again; unknown or unavailable inputs cannot become successful inapplicability.
The existing revision/clean-state cache does not by itself complete this obligation.
Preserve receipts, failed observations and unaffected evidence throughout repair.

## Applicability and evidence

An empty formatting selection and an empty lint selection are independent
inapplicability observations. A component can have format inputs but no lint
inputs, or maintained code but no test suites. Suite absence affects only
`owner-tests`; shared types/build applicability follows its configured project
inputs independently. An unavailable required operation remains unavailable
under FND-9 and cannot be reported as a successful empty check.

Testing retains intentional expected-red owner-test evidence while requiring
passing applicable quality checks. Implementation requires passing applicable
checks. Completion requires current evidence for each operation; one passing
operation or an empty completed reply cannot satisfy another obligation.
Failures retain exact command, directory, exit status, diagnostics, log reference,
scope and expectation for the same caller. Ordinary repair stays within the
milestone and preserves receipts, failed observations and unaffected evidence.

Under FND-1, build cleanup and compiler output remain confined to the declared
`dist/` root. Selection and read-only format/lint checks introduce no generated
root, source mutation or automatic fixer. The host continues to enforce confinement
and owns assembled verification, independent reviewed staging delivery and activation.

Public regression evidence for this prerequisite must demonstrate distinct owner
selections, unknown owners and ambiguous ownership, inclusion of newly created
maintained files, exclusion of ignored/generated inputs, and separate empty
format/lint selections. It must also establish unchanged no-owner coverage and
strictness, unchanged owner-test inventory and no maintained-source mutation.
These are required observations, not claims of implemented or passing behavior.

## ESLint rule regressions

For rejected input, assert both the rule ID and message ID. For valid input,
assert zero diagnostics.
