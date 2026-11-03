# Valid architectural regression fixtures

Ordinary component fixtures must satisfy the packaged component schema before a
scenario can reach its expected missing-behavior assertion. The shared
`ComponentV5Fixture.component` builder validates v5/v6 declarations immediately;
missing ownership or parent fields are setup errors, not regression evidence.
Use the explicitly named `uncheckedComponent` builder only when the scenario
intentionally tests malformed authored configuration. It must still assert the
production loader's rejection.

Schema validity alone does not establish a valid composition. Positive scenarios
must load their complete committed catalog before checking an absent API or other
new behavior. This catches overlapping ownership, invalid ancestry and unresolved
references before expected-red matching can conceal them. Assertions must retain
the caller's scope, including selected package roots where required.

These checks improve deterministic setup; they do not establish real-agent
specification quality or authorize changes to frozen acceptance in retained runs.
The failed #173 run remains evidence, and #184's fresh real-agent qualification
remains required.
