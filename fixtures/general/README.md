# General execution fixture

A small greeting package with separate CLI, service and names owners. The source
fixture uses TypeScript; `fixtureFiles('general')` exposes its compiled runnable
payload after the ArcNexus build. Materialize that payload in a separate Git
repository, declare `https://example.invalid/greetings.git` as its origin identity,
and commit it before running ArcNexus. No network access to this example origin is
needed. The CLI owner maintains shared package configuration and container definitions.

The package declares Luna engineering and Astra director/reviewer profiles, all
minimal v5 public boundaries, one shared assembled-package test operation and no execution budgets. Put
machine executable bindings in `.git/arcnexus/bindings.yaml`; do not commit them.

From the committed fixture repository, use `arcnexus task run "<prompt>"` or
`arcnexus workday start`. The five workday controls take no options. The live
campaign in `experiments/general-live.yaml` requests a real three-owner shout
feature through dynamic inbox dependencies. Simulated results cannot qualify it.
