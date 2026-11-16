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

The first Foundation delivery compiles the app and plugin layout and exercises
Cordis composition through the built test path. Build output belongs in `dist/`.
Use one configuration for source, app and plugin tests, and shared tooling.

Put suites in the owning app or plugin under `tests/unit`, `tests/integration`
or `tests/acceptance`. The test runner derives the level and owner from that path
and the catalog. Run `npm test` for all suites or `npm test -- <owner>` for one
owner. Formatting and lint fixes take explicit owner paths.

## ESLint rule regressions

For rejected input, assert both the rule ID and message ID. For valid input,
assert zero diagnostics.
