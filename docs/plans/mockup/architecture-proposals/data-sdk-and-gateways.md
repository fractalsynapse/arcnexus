# Manage component models through Data and Commands

**Approved direction. Isolated implementation in progress.** Each enabled display requests the resources
it needs. API, MCP and CLI share a Data SDK for managing domain models and a
Commands SDK for running workflows. Model definitions and their implementations
stay with their component stewards.

The [approved contract amendment](../../../../packages/architecture/docs/proposals/data-sdk-and-gateways.md)
permits implementation and isolated verification. Operator-facing activation
for real projects follows the existing live qualification requirement.

## Implementation status

| Available for isolated review | Evidence |
| --- | --- |
| Data and Plan reads | Owner-registered, validated goal and objective reads at a captured Git revision. REST publishes the registered schemas through OpenAPI. The operator MCP transport uses the same Data operations and authorization hook. |
| Journal replay and follow | REST returns finite JSON or follows the SQLite journal through server-sent events. The scoped Last-Event-ID is the same cursor used for MCP replay. Read-only replay can also use a verified PostgreSQL import. |
| PostgreSQL setup and rehearsal | DB setup applies owner migrations through an advisory lock and records their digests. Rehearsal copies an isolated SQLite snapshot and verifies the PostgreSQL rows, event identities and cursor behavior before reporting success. |
| Enrollment and catalog | The launcher can configure endpoints, exchange a one-use code and check its admission state. The API can admit and revoke providers. The catalog can list, verify imports through an injected repository verifier, and retire entries by operator. |
| Trusted Host composition | The existing CLI workflow delegates to the shared Host plugin. The built CLI still exercises the same Workflow, Coordination and Execution services. |

The [local review stack](../../../../apps/api/README.md) runs Web, API, MCP, PostgreSQL,
and DB setup with dedicated gateway database roles. It serves retained journals from
verified PostgreSQL imports.

The deployment work still includes the PostgreSQL writer and cutover, remote Commands
admission and recovery, native launcher assignment and image lifecycle,
private GitHub provider bindings, and the live web connection/project managers
and Plan displays. The current web setup preview uses fixture data. The native
SQLite workflow remains the execution authority.

## Unified data management

`packages/data` is the public Cordis data management interface. Every domain
model is represented through its owning component's public resource
registration, whether the records live in Git, Coordination's journal, or
another component's storage. A registration declares the model key, identity
and scope, request and result schemas, and the supported operations. Trusted
application composition supplies the registrations and binds them to the
owners' public services. Data checks that each model key has exactly one
registered owner and that each declared operation has a handler.

Data defines one typed interface for `list`, `read`, `create`, `update` and
`delete`, with model-specific inputs and results. It also supports operations
that belong to a particular model, such as replaying and following journal
events. Each model declares which operations exist and which callers may use
them. An append-only journal can expose reads and follow while Coordination
owns event creation as part of execution. File edits use the owning service's
revision rules. Changes to approved goals retain the existing approval and
delivery path. [Project contract](../../../interface/arcnexus-project.md) · [Planner contract](../../../../packages/planner/contract.md) · [Coordination contract](../../../../packages/coordination/contract.md)

| Steward | Responsibility |
| --- | --- |
| **Data** | Own the common operation interface, resource registrations contract, shared schema conventions and cross-model compatibility checks in `packages/data`. |
| **Model owner** | Own the model schema, validation, storage, migrations and operations. Export the schema and supported operations from the component's public entry. Planner, Coordination and future owners each supply their own models. |
| **Commands and Workflow** | Own task admission, command outcomes, streaming observations, approvals and recovery. Use the existing writer and journal for execution. |
| **API, MCP and CLI** | Own transport, caller identity and presentation. Resolve a verified project on the trusted host. Call the same model and workflow operations under the initiating caller's authority. |
| **Web** | Own display registration and request lifecycles. A display uses the API operations for its models. |

For a shared schema change, the Data steward defines the interface change,
identifies the affected models and routes the work through Direction. Each
accountable steward changes its own schema and implementation. Data verifies the
combined contract and adapter parity. API assembles the OpenAPI description
from its operations and the registered schemas. MCP uses those same schemas
for the data tools it exposes. This lets a component add a model or compatible
field through its own public entry. [Team contract](../../../../packages/team/contract.md) · [Direction contract](../../../../packages/direction/contract.md) · [OpenAPI operations](https://spec.openapis.org/oas/latest.html#operation-object)

Architecture would register `data` for `packages/data`, and separate app
stewards for `apps/api`, `apps/mcp`, `apps/db`, `apps/host` and
`apps/launcher`. The CLI and web stewards own their existing app surfaces.

## Local platform services

Include `apps/db` and the Host launcher in the first local deployment that
runs Web, API and MCP together. A shared root `compose.yaml` under the Release
steward runs the long-lived platform services and the DB setup job. The
launcher starts project execution containers on demand. Each application
steward owns its build and entry point.

| Compose service | Responsibility |
| --- | --- |
| **PostgreSQL** | Run the shared database on a private network with a persistent volume. Model owners keep their schemas and storage rules. |
| **DB setup** | Run the `apps/db` migration command once per deployment. It composes the migration steps from model owners, records applied versions, and exits successfully when the schema is ready. The first slice covers migration and schema status. Backup and restore also belong to this app as operator commands. |
| **API and MCP** | Run separate adapters. Both compose Data and its owner bindings and connect to the same PostgreSQL database for permitted model operations. Workflow actions go through the execution host. Give each adapter a runtime role scoped to its allowed database operations. |
| **Web** | Serve the browser app and connect it to the API through the local same-origin entry point. The browser requests resources from the API and receives status independently for each display. |

Compose starts PostgreSQL and waits for database health. It then runs the DB
setup job and uses successful completion as the startup dependency for API
and MCP. Those services can start in parallel after the schema is ready. On
startup, a failed migration surfaces through the DB job and blocks the
dependent services. Web can serve its shell while the API is unavailable.
At runtime the adapters report database or host unavailability through the
affected operation. [Compose startup dependencies](https://docs.docker.com/compose/how-tos/startup-order/)

DB setup uses a dedicated migration role. Serialize migration attempts and
make a repeated startup recognize already applied versions. API, MCP and the
execution host check schema compatibility at startup and use runtime roles
without schema-changing privileges. Model owners supply migration ordering or
dependencies through their public entries. An incompatible upgrade first
quiesces the affected writers. Importing an existing SQLite project is a
separate operator action with retained verification evidence. The local
platform uses the same authoritative journal for each project after its
cutover. [Coordination contract](../../../../packages/coordination/contract.md)

Project bindings identify which verified repositories the local host serves.
The owning services provide authorized reads of Git revisions and retained
artifacts to Data. These bindings keep file-backed resources usable across
containers and leave worktree and provider effects with the execution host.

## Host launcher

Build `apps/launcher` as a small strict TypeScript executable packaged with
`bun build --compile`. The local binary runs alongside Docker Engine. Use it
from the first local deployment and keep the same registration and launch
contract for a hosted deployment. A hosted deployment can supply a different
container runtime adapter behind that contract. [Bun compiler](https://bun.com/docs/compiler)

Configure the platform endpoints with `ARC_API_URL` and `ARC_MCP_URL`, or
persist their non-secret defaults with `arcnexus-launcher configure`.
Environment settings take precedence. The launcher registers through one
authenticated outbound API connection for assignments, status and
reconnection. The launcher can check the configured operator MCP endpoint
during setup. Commands submitted through MCP or API use the same routing and
launch lifecycle. The activity-scoped MCP endpoint inside each Host remains
bound to its captured operation permissions.

The launcher resolves a verified project ID to a locally approved image,
directory binding and credential binding. It starts or reuses the private
`apps/host` container and reports its identity and readiness. A repeated
launch request reconciles the existing container before starting another.
The Host checks the captured project and image and acquires Coordination's
writer before running the command. For local Compose, Host joins the private
platform network and checks schema compatibility before accepting work.
Configure the platform addresses used by the native launcher separately
from the worker's internal service addresses.

### Connect a capacity provider

An authorized operator opens **Connection manager** from the computer icon
in the web header. With no providers, show the launcher download for the
detected operating system and architecture when a matching build is
published. Offer explicit target selection for other machines and when the
browser cannot identify the target. Show the registration code with setup
instructions. With providers present, list online, offline and pending
connections and keep setup available for the next provider.

The platform issues a single-use registration code. A launcher exchanges
it over the configured API for a pending identity. An authenticated
operator admits or declines that identity. Admission binds a scoped
credential to the provider and enables authenticated reconnect. Show
green for an authenticated online connection, gray for offline and amber
for pending admission. Pair each indicator with a text label. Revocation
disconnects the provider, invalidates its credential and removes it from
new launch routing. Host and Coordination retain execution evidence and
reconcile any interrupted work through the existing writer rules. Capacity
metrics are deferred.

### Project directories and Codex sign-in

The operator registers a local project directory with the launcher. Verify
its canonical Git identity and copy the selected committed revision into a
managed project volume. Use the same stable paths for its Git store,
worktrees and evidence when replacing the container. Keep writes in the
Host's task worktree. A later local source update can supply another approved
revision. Project directories and run state stay on the execution machine
and outside the image build context.

For a file-backed Codex login, the operator can seed a fresh private
`CODEX_HOME` once with the approved local `auth.json`. Store it on a
dedicated credential mount with access restricted to the trusted Host.
Preserve Codex's refreshed credentials across container replacement. Assign
each login cache to a single serialized stream. Use independent sign-ins
for concurrent Hosts or concurrent desktop use. Keyring-backed credentials
use a supported sign-in on the destination. Keep credential data local to the
execution machine, separate from project files, launch messages, images and
run evidence. [Codex credential storage and headless login](https://learn.chatgpt.com/docs/auth#login-on-headless-devices)
· [Codex refresh and concurrent jobs](https://learn.chatgpt.com/docs/auth/ci-cd-auth#operational-rules-that-matter)

## Execution host container

Use a Linux image built from `apps/host/Dockerfile` with the trusted Cordis
composition and pinned runtime tools, including Git, the provider client,
Codex and Bubblewrap. Run it as a dedicated non-root user on the private
service network. Publish the operator-facing API and MCP entry points and
keep Host discovery and requests internal. Give it outbound access for
approved Git remotes and configured execution providers. Keep Docker daemon
access with the operator and isolate each project's repository, worktrees and
execution lane.

Mount trusted bindings read-only from deployment configuration. Supply
credentials through the platform secret mechanism and resolve them in the
owning provider plugin when needed. The Host provisions the current
`.git/arcnexus/bindings.yaml` in each managed checkout from trusted
configuration, pointing to the executable installed in the image. Preserve
Git stores, worktrees and retained evidence on Host-owned volumes at stable
container paths. For example, store repositories under `/var/lib/arcnexus/repos` and
worktrees and evidence under `/var/lib/arcnexus/state`. Keep temporary
execution files on scratch space. PostgreSQL retains the journal and execution
positions. A matched database and Host state restore should recover the same
checkpoints and evidence after container replacement.

Bubblewrap (`bwrap`) launches a process in a Linux sandbox. ArcNexus uses it
to run native checks with a restricted filesystem and environment, an isolated
network and a disposable overlay over the task worktree. Writes to the overlay
disappear when the check exits. Docker packages and runs Host. Bubblewrap
sets the boundaries around individual checks inside it.

Qualify the existing execution boundary inside each approved image on the
target Linux runtime. Docker's runtime policies affect which namespace
operations work. Verify the real model and check paths, network and workspace
confinement, secret isolation, cancellation and restart. If a Docker runtime
cannot enforce the existing contract, keep execution unavailable there. A
native Linux deployment can run the same Host composition when explicitly
selected as that project's execution authority. [Execution contract](../../../../packages/execution/contract.md)
· [Check sandbox](../../../../packages/execution/src/check-sandbox.ts)
· [Docker seccomp profiles](https://docs.docker.com/engine/security/seccomp/)
· [Bubblewrap](https://github.com/containers/bubblewrap#sandboxing)

## Project-specific Host images

Publish an ArcNexus Host base image with the shared Host entry point, Cordis
plugins and required runtime tools. The Host steward owns the base. The
steward responsible for a toolchain owns its derivative build and verification.
Build derivatives using the base digest in `FROM`. Install pinned project
tools during the build and keep the inherited Host entry point and execution
boundaries. The same derivative can serve several projects with the same
toolchain.
[Dockerfile FROM](https://docs.docker.com/reference/dockerfile/#from)

A project can select either of these image sources in trusted deployment
configuration.

| Source | Validation and resolution |
| --- | --- |
| **Local Dockerfile** | Use a local Dockerfile path and its declared build context. Validate the exact build inputs, including the pinned ArcNexus base and the files available to the build. Build through the operator's builder, record the local image ID or exported manifest digest, and retain the artifact for restart and recovery. |
| **Registry image** | Use a public or private registry reference. Resolve any tag to a digest for the target platform, pull that exact image, and validate its ArcNexus base, inherited Host entry point and toolchain. Pin deployment to the verified digest. |

Both paths qualify the resulting image on the target runtime before the
operator approves it for the project. Record the source, the resolved image
identity and the target platform. A change to the approved build inputs or
selected image requires fresh validation. [Docker build context](https://docs.docker.com/build/concepts/context/)
· [Docker image digests](https://docs.docker.com/dhi/explore/security-concepts/digests/)

The launcher selects the approved derivative for each project and starts
the corresponding Host when requested. A stack can run different toolchains
side by side. API and MCP keep the same contracts, and Coordination enforces
one writer per project across all workers. Persist the project's
repositories, worktrees and evidence across image changes. A repository
import can propose an image source or toolchain requirements for the
operator to review.

Keep operation definitions in the project's approved architecture. For
example, install ShellCheck in a derivative image, declare `shell-lint` once
and reference it from each activity that needs it. Each activity can bind its
own validated file inputs. Execution resolves the command in the confined
environment and applies the activity's captured authorization. The image
supplies the executable. The operation binding supplies permission to invoke
it. A required operation with an unavailable executable reports a failure.
[Operation parameter resolution](../../../../packages/architecture/src/operation.ts)
· [Confined check execution](../../../../packages/execution/src/check.ts)

Capture the resolved Host image identity, its base digest and relevant tool
identities at admission. Include them in execution evidence and check reuse
decisions.
For the first deployment, apply a replacement image to new work after the
project lane is clear. Resume interrupted work on its captured image. If
that image is unavailable, report the prerequisite so the operator can
restore it or review a runtime adoption under the existing approval rules.
[Project contract](../../../interface/arcnexus-project.md)
· [Check evidence identity](../../../../packages/execution/src/check-cache.ts)

## Git-backed project catalog

The platform catalog lists the projects the Host can serve. Import from an
authorized public or private Git remote and record the verified repository
identity, source commit and credential binding reference. A catalog imported
from Git can propose entries for several repositories. Resolve and verify
each repository through its own provider binding before enabling it.
A Catalog steward would own those platform records and expose them through
Data. Collaboration resolves remotes and credential bindings. Architecture
validates each project's versioned component and steward definitions as
data. Host admission requires an approved capture and trusted bindings.
Refreshing a catalog can surface a newer revision while active tasks keep
their captured revision and authority.

Start with the current canonical GitHub remote boundary. Public catalog reads
can use anonymous fetch where available. For private GitHub imports, propose
installation credentials scoped to read the selected repository through
Collaboration. Keep publication authority separately granted under the
project's delivery policy. Catalog records carry credential references.
Secrets stay with the trusted provider and outside clone URLs, event payloads
and agent tool inputs. [Current GitHub adapter](../../../../packages/collaboration/src/index.ts)
· [GitHub App installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)

### Select the active project

Open **Project manager** from the folder icon between Connection manager
and Color schemes. Put the active project selector first. Show the
selected project beside the heading on each workspace. Provide an add
action for public and private GitHub repositories and a remove action on
each entry. Use an authorized provider binding for private repositories.
Show reachability and its diagnostic separately from registration. Start
the review with the verified ArcNexus repository. Removing a catalog entry
removes it from selection and routing while retaining associated Git and
run evidence. Project metrics are deferred.

Carry the selected project identity through workspace navigation, API
requests, command submissions and event subscriptions. Keep per-project
request caches and cursor state. Switching projects closes subscriptions
for the old selection and resolves the new workspace context. If the
active project is removed, select another reachable project when possible
or show the unselected state.

Both managers use the shared React frame, dialog, theme and controls.
Trusted Cordis contributions register the header actions. Compose common
layouts and controls through React props, children and hooks so feature
components reuse the same presentation and behavior. [Existing dialog](../../../../packages/ui/src/controls/dialog.ts)

The local React preview illustrates these flows with fixture registration
and project entries. Launcher publishing and live enrollment and
reachability checks belong to the platform implementation. [Platform setup preview](../../../../apps/web/README.md#platform-setup-design-preview)

## Concurrent API and MCP requests

API and MCP can read the same data and perform authorized CRUD concurrently.
The owner applies a revision check atomically with each revisioned write.
If both adapters submit edits against the same revision, the accepted change
advances it and the stale request reports a conflict. Operations that change
workflow state, such as answering an approval question, go through Commands.

If the browser starts Plan through API and an MCP client submits Run for the
same project, the host checks both requests against Coordination's single
writer. The competing request receives the active execution identity under
the existing admission rules. Both gateways can read retained events for
that execution. Restarting an adapter interrupts its connections. The host
continues the workflow and clients reconnect from their journal cursor.

The PostgreSQL amendment must define how Coordination proves writer
ownership across process and container boundaries. The current SQLite lease
uses the local kernel's process identity. Test loss of a writer connection,
cessation of host effects, and reconciliation of retained work before
readmission. For projects assigned to the stack, the platform CLI reaches
that hosted authority through the API. Standalone CLI execution is for
projects assigned to local mode. [Current writer identity](../../../../packages/coordination/src/lease.ts) · [Existing host composition](../../../../apps/host/src/index.ts)

## REST resources for independent Plan displays

The API publishes narrowly scoped resource operations in OpenAPI. Collection
`GET` lists summaries with model-specific filters. Item `GET` reads one
resource. Collection `POST`, item `PATCH` or `PUT`, and item `DELETE` map
to the supported model writes. A revisioned edit carries the expected
revision, mapped from `If-Match` for a conditional REST update. The owning
service checks it before applying the change. An owner can return a proposal
or a pending approval when its workflow requires one. Each operation has a
declared result, error shape and permission. [HTTP If-Match semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)

The page supplies the project reference and the selected Plan execution
identity. If a display needs the current execution and the route has none,
resolve the active refinement Plan or the latest retained one with a small
execution reference read. Keep the selected identity and captured guide
revision pinned across panel requests. A project without a retained execution
can still show the approved objective and goal collections at a verified
revision. The paths below are proposed, relative to `/projects/{project}`.

| Consumer | Resource requests |
| --- | --- |
| **Execution selection** | `GET /plan-executions/current` resolves the execution reference. Return the invocation, round and captured guide revision when available. |
| **Planner outcome** | `GET /plan-executions/{plan}/outcome` returns the recorded status, outcome and references. Fetch a referenced question or approval detail when opened. |
| **Planner metrics** | `GET /plan-executions/{plan}/metrics` returns Planner measurements with their basis and available values. Fetch `GET /plan-executions/{plan}/tool-counts` when Tools by frequency is expanded. |
| **File explorer** | `GET /objectives` and `GET /goals` list summaries at the requested revision. The explorer asks for the collections it displays and can filter by topic, priority or changed state for the selected execution. File content and revisions load when the operator opens a file. |
| **Event log** | `GET /plan-executions/{plan}/events` reads or follows the selected execution. Event records carry complete exposed messages and correlated operation references. Fetch detailed tool inputs, outputs and artifacts when inspected. |

A display registration supplies discovery metadata for Page Settings. Mounting a
display enables its queries or subscription. Turning it off cancels the
display's pending requests and closes its subscriptions when it was the last
consumer. Reordering, resizing and moving displays between columns preserve
their requests and cursor state. When displays request the same resource in
the same project, revision, filter and authorization context, the client can
share that request. Each display refreshes or follows its own resource as
needed. For example, Planner outcome can update while Event log is off. Each
display handles its own loading, empty and failure states.

Refinement Plan is the first execution example because its invocation, round
and child task already identify the phase. Standalone planning can reuse a
logical task key. Specify how new standalone executions are distinguished from
recovery before adding their history to the same collection. Data needs a
read-only Coordination entry because the existing open path can create or
migrate a store. [Refinement Plan admission](../../../../packages/workflow/src/refinement-run.ts) · [Coordination source](../../../../packages/coordination/src/index.ts)

## MCP and CLI parity

The hosted MCP server exposes the authorized CLI operations as structured
tools over the network. For example, `inspect`, `task_plan`, `task_run`,
`architecture_update` and `refine` use the same Commands calls as their CLI
counterparts. `task_run` with a goal uses `runTask`. With no goal, it uses
`runRound`, as the CLI does. Match command inputs, lifecycle outcomes,
approval gates and cancellation under the caller's authority. The CLI owns
terminal rendering and exit codes. MCP owns tool discovery, structured
responses and how clients observe a running command by its retained identity.
The operator's MCP surface is separate from the activity-scoped tools
provided to an agent.

MCP also exposes typed data operations such as `list_goals`, `read_goal`
and `read_plan_timeline`. Expose create, update and delete tools for models
that support those operations and are authorized for the caller. An update
tool accepts the same expected revision as its REST counterpart. Tool
contracts come from the Data registrations used by REST and by future CLI
data commands. Command tools delegate to Commands, while resource tools
delegate to Data. A future `POST /plan-executions` can represent starting
Plan through Commands.
Read-only Plan integration can be reviewed first. [Commands SDK](../../../../packages/commands/contract.md) · [MCP structured tool results](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content)

## Resumable event log

- Data supports finite replay after an exclusive cursor, optionally through an
  inclusive cursor. Without an explicit end, a finite read returns through
  the latest visible event at read start. The result returns that end cursor.
  Follow uses the same cursor to replay and then subscribe to new committed
  events. An event stream can start before the first observation.
- The event resource serves finite JSON or server-sent events. Web starts
  follow from the replay cursor. The API uses the scoped cursor as the SSE ID
  and respects `Last-Event-ID` on reconnect. MCP reads the next range from
  the same cursor. The server rereads committed events after the last cursor
  at the replay-to-live transition to catch events committed during handoff.
- Scope cursors to the authorized project and pinned Plan execution. Preserve
  journal sequence values without converting them to JavaScript numbers.
  Consumers resume from their last applied cursor and deduplicate by event
  identity. Sequence gaps can arise from unrelated journal entries. A cursor
  error lets the consumer restart replay for the same execution. Disconnecting
  a reader leaves the running workflow and its writer active.
- Keep message order and operation correlations. The display groups related
  operation records under messages and loads full operation payloads on
  demand. Browsing or reconnecting rechecks access to the selected resource.
  [SSE reconnect semantics](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header) · [Coordination journal contract](../../../../packages/coordination/contract.md)

## Plan walkthrough

With Planner outcome and File explorer enabled, Plan requests the outcome and
the visible file collections. The metrics and event log endpoints receive no
requests. Enabling Event log loads its history. In the example, the opening
message at `410` is followed by the `list-files` call and result at `411` and
`413`. The browser groups those operations under the message. An operator
opening the result makes a separate request for its details.

The browser disconnects after applying `413`. The Planner's approval question
arrives at `414`. Reconnecting brings in the question once. Planner outcome can
refresh its own status. The operator answers at the existing CLI planning
prompt. The journal records the reply at `416` and outcome at `417`. MCP
reads the same range after `413` and sees the same event identities. Turning
Event log off closes its stream. Turning it back on resumes from the cursor
when the retained display state matches the selected execution. These event
sequences are illustrative.

## Adoption and acceptance

- Register Plan resources through their respective owners. Exercise the same
  resource reads and conditional writes across SDK callers as each model
  capability is adopted. Reject stale revisions, unsupported operations and
  out-of-project access through the same rules.
- Observe network requests while enabling, disabling and rearranging panels.
  Verify that inactive displays do not load data, shared requests survive as
  long as one consumer needs them, and receipt of a tool event does not fetch
  its detailed payload. Keep each panel usable when a different resource
  fails.
- Reconnect across a tool result, an approval pause and a host restart.
  Verify ordered replay without duplicate messages or answers, the same
  cursor semantics across transports and a pinned execution when a newer run
  changes the default selection. Verify that read-only calls create no database,
  run or journal record.
- Keep the first read slice storage-independent. PostgreSQL migration needs
  an approved Coordination amendment and an import that preserves event
  identities, approvals, unfinished positions and the single project writer.
- Start the assembled local stack with API and MCP together. Verify clean
  setup, repeat startup, and a migration failure that prevents dependent
  services from starting. Race an API command against an MCP command on one
  project and confirm Coordination admits one writer. Race conditional data
  writes and confirm a stale revision fails. Restart each adapter during an
  active run and confirm that the host and retained timeline continue.
- Start the first Host through the compiled launcher against the local
  platform. Reconnect during a launch and verify that the same container is
  reconciled. Replace it and confirm it reuses the approved project volume
  and the current Codex auth cache. Verify that another concurrent Host
  needs its own credential binding and that project commands and run
  evidence cannot read the credentials.
- Exercise public and private catalog imports with a permitted repository
  and a refused credential binding. Confirm that import cannot change the
  trusted runtime and an updated catalog preserves active run provenance.
  Replace the Host container using the same image and verify recovery from
  the retained position with real confinement and authorized evidence intact.
- Qualify a derivative image with a tool absent from the base image. Bind
  the same operation for two stewards and verify each gets its own inputs
  and the same confined tool. Confirm an activity without the binding
  cannot call it. Switch the assignment between tasks and verify affected
  checks refresh while retained runs still identify their original image.
- Verify both image source paths. Change a local build input or move a
  registry tag and confirm the existing assignment still points to the
  approved artifact. Confirm an interrupted run resumes on its captured
  image and reports a missing artifact if it is unavailable.
- Review exact contract amendments and the existing qualification gate
  before activating live gateways or adding CLI modes. Exercise each released
  MCP command against the equivalent CLI operation under the same authority
  before calling it parity. [Locked CLI gateway](../../../../apps/cli/contract.md) · [Qualification plan](../../self-development-mvp.md)
