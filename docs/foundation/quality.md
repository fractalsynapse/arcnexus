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

## ESLint rule regressions

For rejected input, assert both the rule ID and message ID. For valid input,
assert zero diagnostics.
