# Build and quality

The [Foundation contract](../../packages/foundation/contract.md) defines shared
entry points and acceptance. Apply the [readable TypeScript standard](typescript-standard.md)
to maintained code, tests and tooling.
Require documentation headers on TypeScript abstract methods under FND-4.
Reject inline ESLint configuration through an error rule under FND-3. Lint
severity comes from the configuration, without a warning-count override.

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
owner. Add `--tag <tag>` or `--level <unit|integration|acceptance>` to select
suites by their literal metadata. Repeated tags are alternatives, as are repeated
levels; owner, tag, level and `--path <file-or-directory>` filters apply together.
Paths are literal source or built paths, and a directory includes its descendants.
Repeated paths are alternatives and do not override ownership. An explicit selection that
matches no suites fails instead of reporting success without running tests.
For example, `npm test -- execution --tag native --level integration --native true`
runs Execution's declared native integration suites. `--native true|false` controls
the existing native-test opt-in for the child runner; otherwise its environment
setting is retained. A selected suite can contain multiple test cases. Formatting
and lint fixes take explicit owner paths.
An explicit `--tag native` selection requires native execution to be enabled;
otherwise the command fails before running suites. A default run that reports
skipped native cases is not evidence that those native cases passed.

Discovery reads exported literal `suite` metadata without importing a test or
executing its code. Declared owner and level must match the catalog and path;
computed metadata and duplicate fields are refused before filtering. Every
maintained suite declares its metadata. Tags describe suites; native selection
does not claim that a controlled provider fixture was a live model observation.

Before running the optional `owner-tests` operation, ArcNexus checks for
suites in the steward's current worktree. An owner with no suites gets an
inapplicability record. It remains a valid component and still needs applicable
formatting and lint, shared types/build and mandatory assembled verification.
`npm run check` checks source, tests, fixtures and tooling without emitting;
`npm run build` cleans generated output and compiles the assembled program.
These are repository checks, not owner-suite substitutes.

Repository source preparation uses the locked toolchain. Preparing dependencies
for a managed runtime candidate belongs to
[Execution](../../packages/execution/contract.md); a working-copy build does not
establish that candidate's dependency environment. Read-only owner checks never
reformat files. Authorized fixes use explicit captured owned paths through the
checked-edit operation or its supported formatting transform.

Formatting and lint share their public commands with owner checks. Use
`npm run format:check -- <owner>` or `npm run lint -- <owner>`; omit the owner
for the assembled repository check. The shared selector uses Git, Team and each
tool's actual configuration. It records the complete selected scope and never
fixes source. See the [owner quality path](../../packages/foundation/docs/owner-quality.md)
for confinement, independent applicability and conservative evidence reuse.

## Owner suite inventory expectations

This reference guides stewards choosing checks and maintainers correcting shared
suite discovery. The accepted correction preserves Foundation FND-5 and FND-6:
owner selection runs exactly the catalog owner's suites, and invalid registration
fails before execution. The public inventory and selection scenarios establish
the diagnostic distinctions and source/built parity described below.

Source applicability and built registration use the same ownership and metadata
rules. `hasOwnerTestSuites(directory, owner, components)` inspects source suites
using the supplied catalog; `testInventory(owner, filter)` inspects built suites
using the working tree catalog. Ownership comes from Team's resolution of the
source path, independently of app/package directory names or exported labels.
For corresponding source and built trees under the same catalog, every owner
with a valid source suite has a corresponding built registration. A known owner
without suites returns false for source applicability. An explicit built
selection with no suites still fails; it is not an inapplicable operation or a
successful test run. Unknown owners remain refused.

Registration maps a built path to its source identity only to validate ownership
and level. It retains the original emitted `file` unchanged for selection results
and execution. For every owner represented in the complete built inventory,
selecting that owner must equal exactly its subset of that inventory. Existing
owner, tag, level, literal path and native selectors retain the semantics above;
the correction requires no caller or operation-parameter changes.

Missing ownership and ownership collisions need distinct diagnostics. Both name
the affected source path; a collision also names every conflicting component ID.
Neither may fall back to a directory-derived owner. Invalid level placement,
contradictory owner or level metadata, duplicate fields and nonliteral metadata
remain errors. Validate the complete discovered inventory before filtering, so
requesting a different owner cannot conceal an invalid suite. Read metadata
without importing suite code; observable module effects occur only during actual
execution.

The missing-declaration correction preserves the requirement that every discovered
suite export literal `suite` metadata with owner, level and tags. Public source
applicability and built inventory reject a discovered suite without that export,
naming the affected
file and the missing required suite metadata as the registration cause.
Path-derived ownership and level do not replace the declaration, and missing
metadata must not become an empty tag list or an omitted suite. The shared
literal metadata reader rejects a missing declaration before owner filtering
and without importing the module.

The existing public
[inventory scenarios](../../packages/foundation/tests/unit/test-inventory.test.ts)
and [selection scenarios](../../packages/foundation/tests/unit/test-selection.test.ts)
use explicit catalog fixtures, an owner without suites and ownership independent
of directory names. They compare source applicability with corresponding built
registrations and every represented owner's selection with the complete built
subset, including unchanged emitted paths. Negative cases identify the missing-owner
or collision cause and path, all collision IDs, invalid placement and metadata.
Missing-declaration cases cover both the selected owner and a foreign owner.
Both public source applicability and built inventory refuse the unregistered suite
with its file and missing-registration cause while its observable module effect
remains dormant.

Run 205 retains the original behavioral red in `205-196-owner-tests.log`: the
four missing-declaration assertions failed while the existing characterization
passed. After the shared reader correction, `205-291-owner-tests.log` records
`npm test -- foundation` exiting zero with all 64 cases passing across eight
Foundation suites, including inventory and selection. Both logs are retained in
the run's external evidence directory, indexed by its timeline. The correction
reuses discovery, registration and the literal parser; it removes the reader's
undefined fallthrough without adding another classifier or changing emitted paths.
Retain applicable owner formatting, lint, repository types and build observations
with each actual command, scope, directory, exit and evidence reference against
the candidate observed.
Assembled verification and independent review remain separate host obligations.
The measurable benefit is actionable ownership failures and exact suite coverage
for every represented owner through the existing shared path. Human callers,
steward operation bindings and CI keep their existing entries.

## Specification ownership diagnostics

For maintainers correcting a catalog, `npm run check:specification` is the shared
working-copy specification check. Its entry is
[check-specification.ts](../../packages/foundation/scripts/check-specification.ts);
it reads the tracked Git inventory and authored catalog. The intended ownership
diagnostic correction below is recorded before implementation; executable
regressions must establish the behavior before it is described as demonstrated.

Every tracked maintained path must have exactly one owner under the
[project contract](../interface/arcnexus-project.md). Use
[Team's coverage view](../../packages/team/contract.md) over the complete catalog
and inventory to report every uncovered path and every collision. Each collision
diagnostic identifies the affected path and all conflicting component IDs.
Invalid ownership makes the command fail with a nonzero exit; stopping at the
first path or reporting only an owner count does not provide complete findings.
Representative uniquely owned specifications continue through the existing
TypeScript, activity, contract, link and skill validation.

Ownership findings remain independent of roster eligibility or activity filters:
excluding a steward cannot conceal its conflicting ownership or make an owned
path unowned. Team remains the shared source for eligible stewards, supplier
discovery and ownership; the checker introduces no separate ownership map or
fallback owner. A supplier request grants no edit capability. An unchanged
catalog and inventory produce identical ownership diagnostics on repeated calls,
with stable path ordering and stable component-ID ordering within collisions.

This check reads maintained source without repairing or formatting it. Its
optional existing CI applicability output is separate from source mutation.
Acceptance requires subprocess scenarios through the real command with explicit
tracked Git/catalog fixtures: unique ownership passes; mixed uncovered and
colliding paths fail and report every finding and conflicting ID. Repeated invalid
runs must retain identical ownership diagnostics and unchanged maintained bytes.
Preserve coverage of the other specification validations and obtain applicable
Foundation quality observations for the implemented candidate.

The measurable benefit is complete actionable ownership feedback in one failed
invocation, rather than discovering additional affected paths through successive
repairs. Human and CI callers keep the existing entry and invocation; Team
consumers need no interface changes. This correction changes reporting, while
catalog authority, owner boundaries and supplier permissions stay governed by
their existing contracts.

## ESLint rule regressions

For rejected input, assert both the rule ID and message ID. For valid input,
assert zero diagnostics.
