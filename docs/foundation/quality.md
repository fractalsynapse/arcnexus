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

## Owner-scoped quality intent

The following behavior is intended for the quality-applicability prerequisite;
owner-scoped format/lint commands and their shared selection result are not yet
implemented. New operation mappings become available only after the prerequisite
implementations and exact approved guide batch are delivered together inside
Architect and captured for subsequent work.

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

Reuse Foundation's existing discovery and Team integration where sufficient.
The current source/built suite discovery already shares registration rules;
`check-specification` also obtains a Git inventory for maintained-path validation.
Neither is currently a common format/lint selection API: suite discovery omits
non-test files and built suites cannot identify new source files. A small shared
maintained-file discovery and selection helper is therefore needed by commands
and Execution applicability. Factor common discovery where appropriate without
copying suite registration, changing the owner-test inventory, hardcoding component
IDs or creating another inventory store.

Expose selection through Foundation's public entry for both command execution
and applicability consumers. Each result must identify:

- The operation and optional owner, and the deterministic repository-relative
  selected paths or a scope identity that resolves to those exact paths.
- The maintained discovery inputs and content identities, ownership projection,
  operation coverage, ignores and tool/configuration inputs needed to determine
  whether the result still matches the current invocation.
- Whether that operation has inputs; an empty selection carries its precise
  operation-specific reason and scope rather than a generic no-tests result.

Commands must execute the same selection used for applicability. The result
supplies scope and input identity for the host's existing evidence mechanism;
it is not a second evidence store or a grant of authority. Recompute affected
selection and evidence after relevant edits, newly created files, ownership,
configuration or tool changes. Reuse observations only when relevant inputs,
captured authority, expectations and environment still match.

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
