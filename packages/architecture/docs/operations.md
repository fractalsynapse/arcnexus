# Configuring reusable activity operations

The operation declaration defines its executable, confinement and argument tokens
once. Parameters have explicit types and optional defaults. Component
`operationParameters` overrides those defaults; a configured use in an activity's
`operations` list overrides component values. Scalar and array values replace
earlier values. An explicit empty array stays empty.

An argument token is `{ parameter: <name> }`. A string array expands into argv
entries; a scalar becomes one argument. Literal strings stay literal. No shell or
expression evaluator participates. `{ context: owner }` remains a host-owned
identity value and cannot be replaced through parameter configuration. Model tool
calls select their captured operation; this implementation introduces no
model-supplied configuration override.

For example, one test operation can declare a `selectors` string-array parameter,
defaulting to `[]`, and place its token after the test command's existing arguments.
An activity can configure that use as:

```yaml
operations:
- operation: tests
  parameters:
    selectors: [--tag, regression]
verification:
- tests
```

The command's own documented selector syntax determines which values to supply.
Configuring selectors does not invent test-runner support for an absent option.
The resolved request shows actual argv, parameter values and their authored sources.
Execution uses that same resolver and includes resolved parameters in check-input
identity. Unknown keys, unresolved tokens and incorrect types are errors rather
than silently ignored configuration.

`verification` names mapped check commands that must pass before this activity can
complete, even when an agent omits a call. A model cannot relabel those checks as
expected failures. Declare only checks that must be green at that point: Testing
may separately observe an intended failing regression, while Implementation must
establish the passing result. Missing suites do not waive other applicable checks.
Assembled acceptance remains independent of activity completion.

Actual catalog changes still require their exact architecture approval before
adoption. The [efficiency checklist](../../../docs/plans/efficiency-foundation.md)
tracks integration, test selectors, live architecture adoption and qualification.
