# Inspection parity characterization

Testing for `execution-inspection-activation-parity` characterizes the existing
production behavior. No product behavior was changed and no behavioral red is
claimed. The governing intent remains [inspection parity](inspection-parity.md).

The [public scenarios](../tests/integration/inspection-activation.test.ts) use
production Architecture capture, Agent preparation, Execution admission, a real
SQLite journal and an issue-numbered Git worktree before activation. An explicit
compiled TypeScript executable receives native stdin and argv and calls the
production LocalMcp HTTP endpoint. Collaboration publication and remote-head
observations are isolated at their public boundary; this is not hosted delivery.

| Criterion | Caller, observable result and discriminating assertion |
| --- | --- |
| `parity-exact-native-request` | Director, steward and Reviewer activate through HostTask and Agent. Compare the entire subprocess stdin to the prepared request with identical enriched inputs, including Reviewer's retained candidate diff. Independent assertions require full purpose, selected procedure, authored source labels and all named unavailable inputs. Dropping context from both paths cannot satisfy those assertions. Native cwd, model and reasoning are checked against resolved options. |
| `parity-captured-activity-tools` | The subprocess calls actual MCP tools/list. Compare operation identities, exact descriptions and schemas with structured inspection and rendered Operations. Disjoint read/list activities and explicit empty activities reject inherited grants. Calls to another activity's operation and shell must return the mapping refusal; a mapped foreign edit must name the captured reviewer owner and preserve the exact original file. |
| `parity-provider-policy-guidance` | Actual argv records cached web with tools, disabled web with tools, and both disabled and live web with empty project tools. Approved guidance and skill bytes remain visible in the native cwd, absent from pasted prompt content, with discovery-disabling flags absent. Changed guidance is refused before a native request artifact exists. |
| `parity-current-inspection-evidence` | Repeat public inspection with throwing model, admission and upstream sentinels; compare complete output, Git status, worktrees and absence of application storage. Execute the existing built CLI request-parity and inspect suites in a separate test process and retain their TAP output, requiring no failures or skips. Those scenarios compare rendered and structured requests. |

The current passing characterization observation is retained by run 120 as
`120-498-owner-tests.log`, through the host's registered evidence path. It includes
complete controlled subprocess observations (captured revision, executable,
Node version, stdin, argv, cwd, discovery, refusals and guidance bytes) and the
assembled CLI TAP output. The host associates the operation with the actual
candidate checkpoint. Earlier observations remain readable: initial fixture
failures involved unisolated Collaboration calls, Git branch display decoration,
cleanup ordering, Reviewer's missing enriched comparison input, the compiled CLI
path and inherited Node test-runner context. They are setup feedback, not red.

The controlled executable proves transport and file visibility, not live inference
or the real Codex harness interpreting discovered guidance. Existing native
confinement scenarios skipped by the ordinary owner suite remain skipped; this
characterization does not turn those into passes. Hosted CI, live qualification,
independent assembled verification and delivery remain with their normal owners.
