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
inapplicability record. Assembled verification still runs its required checks.

Formatting and lint share their public commands with owner checks. Use
`npm run format:check -- <owner>` or `npm run lint -- <owner>`; omit the owner
for the assembled repository check. The shared selector uses Git, Team and each
tool's actual configuration. It records the complete selected scope and never
fixes source. See the [owner quality path](../../packages/foundation/docs/owner-quality.md)
for confinement, independent applicability and conservative evidence reuse.

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
